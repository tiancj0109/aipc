from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import httpx
import logging

from app.database import get_db, SessionLocal
from app.models.chat import ChatSession, ChatMessage
from app.models.model_registry import ModelRegistry
from app.schemas.chat import ChatSession as ChatSessionSchema, ChatSessionCreate, ChatMessage as ChatMessageSchema, ChatRequest, ChatSessionDetail
from app.utils.crypto import decrypt_api_key
from app.utils.provider import normalize_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


def _extract_stream_payload(raw_payload: str) -> dict:
    if not raw_payload:
        return {"done": False, "stop": False, "content": None, "reasoning_content": None}
    payload = raw_payload.strip()
    if not payload:
        return {"done": False, "stop": False, "content": None, "reasoning_content": None}
    if payload == "[DONE]":
        return {"done": True, "stop": True, "content": None, "reasoning_content": None}
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return {"done": False, "stop": False, "content": None, "reasoning_content": None}
    if not isinstance(data, dict):
        return {"done": False, "stop": False, "content": None, "reasoning_content": None}

    choices = data.get("choices") or []
    if not choices:
        return {"done": False, "stop": False, "content": None, "reasoning_content": None}

    choice = choices[0] or {}
    delta = choice.get("delta") or {}
    message = choice.get("message") or {}
    finish_reason = choice.get("finish_reason")

    content = delta.get("content")
    if content is None and isinstance(message, dict):
        content = message.get("content")

    reasoning_content = delta.get("reasoning_content")
    if reasoning_content is None and isinstance(message, dict):
        reasoning_content = message.get("reasoning_content")

    stop = isinstance(finish_reason, str) and finish_reason.lower() == "stop"
    return {
        "done": False,
        "stop": stop,
        "content": content if isinstance(content, str) else None,
        "reasoning_content": reasoning_content if isinstance(reasoning_content, str) else None,
    }
@router.get("/sessions", response_model=List[ChatSessionSchema])
def list_sessions(db: Session = Depends(get_db)):
    return db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()

@router.post("/sessions", response_model=ChatSessionSchema)
def create_session(session_in: ChatSessionCreate, db: Session = Depends(get_db)):
    session = ChatSession(**session_in.dict())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"status": "success"}

@router.post("/completions")
async def chat_completions(req: ChatRequest, db: Session = Depends(get_db)):
    # 1. Get model
    model = db.query(ModelRegistry).filter(ModelRegistry.id == req.model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # 2. Get or create session
    current_session_id = req.session_id
    if current_session_id:
        session = db.query(ChatSession).filter(ChatSession.id == current_session_id).first()
        if not session:
            logger.warning(f"Session {current_session_id} not found, creating new one")
            current_session_id = None

    if not current_session_id:
        title = req.message[:50] + "..." if len(req.message) > 50 else req.message
        session = ChatSession(title=title, model_id=req.model_id, max_rounds=req.max_rounds)
        db.add(session)
        db.commit()
        db.refresh(session)
        current_session_id = session.id

    # 3. Save user message
    user_msg = ChatMessage(session_id=current_session_id, role="user", content=req.message)
    db.add(user_msg)
    db.commit()

    # 4. Get history (limited by max_rounds)
    # Each round is 2 messages (user + assistant)
    history_limit = (req.max_rounds or 5) * 2
    history = db.query(ChatMessage).filter(ChatMessage.session_id == current_session_id).order_by(ChatMessage.created_at.asc()).all()
    
    # Slice to keep only the last N messages
    if len(history) > history_limit:
        history = history[-history_limit:]
    
    messages = [{"role": m.role, "content": m.content} for m in history]

    # 5. Extract model info BEFORE the generator (ORM objects detach after session closes)
    model_name = model.name
    model_version = model.version
    model_endpoint = (model.api_endpoint or "").strip().strip("`'\"").rstrip("/")
    model_api_key_enc = model.api_key_encrypted
    model_default_params = model.default_params
    model_provider = normalize_provider(model.provider)

    # Resolve real model ID: default_params["model"] > version > name
    real_model_id = model_version or model_name
    if isinstance(model_default_params, dict) and model_default_params.get("model"):
        real_model_id = model_default_params["model"]
    
    real_model_id_str = str(real_model_id).lower()
    is_kimi = model_provider == "moonshot" or "kimi" in real_model_id_str or "moonshot.cn" in model_endpoint.lower()

    # Deep thinking: provider-specific logic
    is_deep = bool(getattr(req, "deep_thinking", False))
    if is_deep:
        if "deepseek" in model_provider or "deepseek" in real_model_id_str:
            # DeepSeek: switch model to deepseek-reasoner
            real_model_id = "deepseek-reasoner"
            logger.info(f"Deep thinking ON → DeepSeek model switched to '{real_model_id}'")
        else:
            logger.info(f"Deep thinking ON → will add enable_thinking=true for '{model_name}'")

    api_key = decrypt_api_key(model_api_key_enc) if model_api_key_enc else ""
    logger.info(f"Chat using model_id='{real_model_id}' (display='{model_name}') endpoint={model_endpoint} deep_thinking={is_deep}")

    async def event_generator():
        full_assistant_content = []
        full_reasoning_content = []
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }
            body = {
                "model": real_model_id,
                "messages": messages,
                "stream": True,
            }
            if isinstance(model_default_params, dict):
                for k in ("temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"):
                    if k in model_default_params and model_default_params[k] is not None:
                        body[k] = model_default_params[k]
                extra_body = model_default_params.get("extra_body")
                if isinstance(extra_body, dict):
                    body.update(extra_body)
            req_temperature = getattr(req, "temperature", None)
            if req_temperature is not None:
                body["temperature"] = req_temperature
            if not bool(getattr(req, "enable_temperature", True)):
                body.pop("temperature", None)

            # Qwen/other providers: add enable_thinking
            if is_deep and "deepseek" not in model_provider and "deepseek" not in str(real_model_id).lower():
                if is_kimi:
                    body["thinking"] = {"type": "enabled"}
                elif "qwen" in str(real_model_id).lower() or "dashscope" in model_endpoint.lower():
                    # 这里的 enable_thinking 即对应用户使用的额外参数 extra_body={"enable_thinking": True}
                    # 在 OpenAI SDK 中，extra_body 会被铺平合并到 JSON 最外层请求体中
                    body["enable_thinking"] = True
                else:
                    body["enable_thinking"] = True
            elif not is_deep:
                if is_kimi and "thinking" not in body:
                    body["thinking"] = {"type": "disabled"}
                elif "qwen" in str(real_model_id).lower() or "dashscope" in model_endpoint.lower():
                    body["enable_thinking"] = False

            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", f"{model_endpoint}/chat/completions", headers=headers, json=body) as resp:
                    if resp.status_code != 200:
                        err_text = (await resp.aread()).decode(errors="ignore")
                        yield f"data: {json.dumps({'error': f'HTTP {resp.status_code}: {err_text}'})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if line is None:
                            continue
                        stripped = line.strip()
                        if not stripped:
                            continue
                        if stripped.startswith(":"):
                            continue
                        if stripped.startswith("event:"):
                            continue
                        if stripped.startswith("data:"):
                            payload_text = stripped[5:].lstrip()
                        else:
                            payload_text = stripped
                        payload_info = _extract_stream_payload(payload_text)
                        if payload_info["reasoning_content"]:
                            rc = payload_info["reasoning_content"]
                            full_reasoning_content.append(rc)
                            yield f"data: {json.dumps({'reasoning_content': rc, 'session_id': current_session_id})}\n\n"
                        if payload_info["content"]:
                            char = payload_info["content"]
                            full_assistant_content.append(char)
                            yield f"data: {json.dumps({'content': char, 'session_id': current_session_id})}\n\n"
                        if payload_info["done"] or payload_info["stop"]:
                            break
            
            # 6. Save assistant message after stream ends
            if full_assistant_content or full_reasoning_content:
                with SessionLocal() as db_final:
                    assist_msg = ChatMessage(
                        session_id=current_session_id, 
                        role="assistant", 
                        content="".join(full_assistant_content),
                        reasoning_content="".join(full_reasoning_content) if full_reasoning_content else None
                    )
                    db_final.add(assist_msg)
                    sess = db_final.query(ChatSession).filter(ChatSession.id == current_session_id).first()
                    if sess:
                        from datetime import datetime
                        sess.updated_at = datetime.now()
                    db_final.commit()
                
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
