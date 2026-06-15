import asyncio
import json
import redis.asyncio as redis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.config import get_settings

router = APIRouter()
settings = get_settings()

@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """
    WebSocket endpoint that streams logs from Redis to the client.
    """
    await websocket.accept()
    print("DEBUG: WebSocket client joined /ws/logs")
    
    redis_client = None
    pubsub = None
    
    try:
        # 1. Send initial connection success message
        from datetime import datetime
        await websocket.send_json({
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:-3],
            "level": "INFO",
            "name": "system",
            "message": "📡 [Backend] Log stream connection established. Subscribing to Redis...",
            "source": "backend"
        })
        
        # 2. Connect to Redis
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("aipc:logs")
        
        await websocket.send_json({
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:-3],
            "level": "INFO",
            "name": "system",
            "message": "✅ [Backend] Subscribed to 'aipc:logs' channel. Ready.",
            "source": "backend"
        })

        # 2.5 Send history logs immediately
        try:
            history = await redis_client.lrange("aipc:logs:history", 0, 999)
            # lrange returns the list from newest (index 0) to oldest (index N) since we used lpush, so we reverse it
            for msg in reversed(history):
                await websocket.send_text(msg)
        except Exception as e:
            print(f"DEBUG: Failed to load log history: {e}")

        # 3. Listen for messages
        # We use a task for heartbeat to keep connection alive
        async def heartbeat():
            while True:
                try:
                    await asyncio.sleep(15)
                    await websocket.send_json({"type": "ping"})
                except:
                    break

        heartbeat_task = asyncio.create_task(heartbeat())
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    # message["data"] is already a string because decode_responses=True
                    await websocket.send_text(message["data"])
        finally:
            heartbeat_task.cancel()

    except WebSocketDisconnect:
        print("DEBUG: WebSocket client disconnected from /ws/logs")
    except Exception as e:
        error_msg = f"❌ WebSocket Server Error: {str(e)}"
        print(f"DEBUG: {error_msg}")
        try:
            await websocket.send_json({
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:-3],
                "level": "ERROR",
                "name": "system",
                "message": error_msg,
                "source": "backend"
            })
        except:
            pass
    finally:
        if pubsub:
            await pubsub.unsubscribe("aipc:logs")
            await pubsub.close()
        if redis_client:
            await redis_client.close()
