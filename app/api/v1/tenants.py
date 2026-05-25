from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.base import get_db
from app.db.models import Tenant, AgentConfig, ApiKey
from app.api.v1.auth import decode_token
from app.config import settings

router = APIRouter()


# --- Schemas ---

class TenantCreate(BaseModel):
    name: str
    slug: str
    description: str = ""


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    is_active: bool
    agent_limit: int
    token_limit: int


class AgentCreate(BaseModel):
    name: str
    description: str = ""
    model: str = "deepseek-chat"
    system_prompt: str = "You are a helpful AI assistant."
    temperature: int = 70
    max_tokens: int = 4096


class AgentResponse(BaseModel):
    id: str
    name: str
    description: str
    model: str
    system_prompt: str
    temperature: int
    max_tokens: int
    is_active: bool


# --- Helpers ---

def get_current_user(token: str) -> dict:
    return decode_token(token)


# --- Endpoints ---

@router.get("", response_model=list[TenantResponse])
async def list_tenants(token: str, db: AsyncSession = Depends(get_db)):
    payload = get_current_user(token)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    result = await db.execute(select(Tenant))
    tenants = result.scalars().all()
    return [TenantResponse(
        id=t.id, name=t.name, slug=t.slug, description=t.description,
        is_active=t.is_active, agent_limit=t.agent_limit, token_limit=t.token_limit,
    ) for t in tenants]


@router.post("", response_model=TenantResponse)
async def create_tenant(req: TenantCreate, token: str, db: AsyncSession = Depends(get_db)):
    payload = get_current_user(token)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    tenant = Tenant(
        name=req.name,
        slug=req.slug,
        description=req.description,
        token_limit=settings.TENANT_DEFAULT_TOKEN_LIMIT,
        agent_limit=settings.TENANT_DEFAULT_AGENT_LIMIT,
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    return TenantResponse(
        id=tenant.id, name=tenant.name, slug=tenant.slug, description=tenant.description,
        is_active=tenant.is_active, agent_limit=tenant.agent_limit, token_limit=tenant.token_limit,
    )


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(token: str, db: AsyncSession = Depends(get_db)):
    payload = get_current_user(token)
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.tenant_id == payload["tenant_id"])
    )
    agents = result.scalars().all()
    return [AgentResponse(
        id=a.id, name=a.name, description=a.description, model=a.model,
        system_prompt=a.system_prompt, temperature=a.temperature,
        max_tokens=a.max_tokens, is_active=a.is_active,
    ) for a in agents]


@router.post("/agents", response_model=AgentResponse)
async def create_agent(req: AgentCreate, token: str, db: AsyncSession = Depends(get_db)):
    payload = get_current_user(token)

    # Check agent limit
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.tenant_id == payload["tenant_id"])
    )
    count = len(result.scalars().all())
    result = await db.execute(select(Tenant).where(Tenant.id == payload["tenant_id"]))
    tenant = result.scalar_one()
    if count >= tenant.agent_limit:
        raise HTTPException(status_code=400, detail=f"Agent limit reached ({tenant.agent_limit})")

    agent = AgentConfig(
        tenant_id=payload["tenant_id"],
        name=req.name,
        description=req.description,
        model=req.model,
        system_prompt=req.system_prompt,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    return AgentResponse(
        id=agent.id, name=agent.name, description=agent.description, model=agent.model,
        system_prompt=agent.system_prompt, temperature=agent.temperature,
        max_tokens=agent.max_tokens, is_active=agent.is_active,
    )
