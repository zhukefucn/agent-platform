from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.base import get_db
from app.db.models import AgentConfig, ChatSession, ChatMessage, UsageRecord, Tenant
from app.api.v1.auth import decode_token
from app.config import settings

router = APIRouter()
security = HTTPBearer(auto_error=False)


# --- Schemas ---

class ChatRequest(BaseModel):
    agent_id: str
    message: str
    session_id: str | None = None


class ChatMessageResponse(BaseModel):
    role: str
    content: str
    tokens_used: int
    model: str


class ChatResponse(BaseModel):
    session_id: str
    messages: list[ChatMessageResponse]
    total_tokens: int


class SessionResponse(BaseModel):
    id: str
    title: str
    agent_id: str
    is_active: bool
    created_at: str


# --- Helpers ---

async def get_current_user(credentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(credentials.credentials)


# --- LLM Router ---

async def call_llm(model: str, messages: list[dict], api_key: str = None) -> dict:
    import httpx
    model_config = settings.LLM_MODELS.get(model, {})
    base_url = model_config.get("base_url", settings.LLM_GATEWAY_URL)
    key = api_key or settings.LLM_GATEWAY_API_KEY

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 4096,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


# --- Endpoints ---

@router.post("/chat")
async def chat(req: ChatRequest, payload: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = payload["tenant_id"]
    user_id = payload["sub"]

    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.id == req.agent_id,
            AgentConfig.tenant_id == tenant_id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    session = None
    if req.session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == req.session_id)
        )
        session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent.id,
            title=req.message[:50],
        )
        db.add(session)
        await db.flush()

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    history = result.scalars().all()

    llm_messages = [{"role": "system", "content": agent.system_prompt}]
    for msg in history:
        llm_messages.append({"role": msg.role, "content": msg.content})
    llm_messages.append({"role": "user", "content": req.message})

    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)

    try:
        llm_response = await call_llm(agent.model, llm_messages)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {str(e)}")

    assistant_content = llm_response["choices"][0]["message"]["content"]
    usage = llm_response.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=assistant_content,
        tokens_used=total_tokens,
        model_used=agent.model,
    )
    db.add(assistant_msg)

    usage_record = UsageRecord(
        tenant_id=tenant_id,
        user_id=user_id,
        agent_id=agent.id,
        model=agent.model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
    )
    db.add(usage_record)

    await db.commit()

    return ChatResponse(
        session_id=session.id,
        messages=[
            ChatMessageResponse(role="user", content=req.message, tokens_used=0, model=""),
            ChatMessageResponse(role="assistant", content=assistant_content, tokens_used=total_tokens, model=agent.model),
        ],
        total_tokens=total_tokens,
    )


@router.get("/sessions")
async def list_sessions(payload: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == payload["sub"])
        .order_by(ChatSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [SessionResponse(
        id=s.id, title=s.title, agent_id=s.agent_id,
        is_active=s.is_active, created_at=s.created_at.isoformat(),
    ) for s in sessions]