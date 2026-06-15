from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime

class ChatMessageBase(BaseModel):
    role: str
    content: str
    reasoning_content: Optional[str] = None

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessage(ChatMessageBase):
    id: int
    session_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class ChatSessionBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    title: str
    model_id: int
    max_rounds: Optional[int] = 5

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSession(ChatSessionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class ChatSessionDetail(ChatSession):
    messages: List[ChatMessage] = []

class ChatRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    message: str
    model_id: int
    session_id: Optional[int] = None
    max_rounds: Optional[int] = 5
    deep_thinking: Optional[bool] = False
    enable_temperature: Optional[bool] = True
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
