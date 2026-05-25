from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.base import get_db
from app.db.models import UsageRecord, Tenant
from app.api.v1.auth import decode_token

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(credentials.credentials)


@router.get("/stats")
async def usage_stats(payload: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = payload["tenant_id"]

    result = await db.execute(
        select(
            func.sum(UsageRecord.total_tokens).label("total_tokens"),
            func.sum(UsageRecord.prompt_tokens).label("prompt_tokens"),
            func.sum(UsageRecord.completion_tokens).label("completion_tokens"),
            func.count(UsageRecord.id).label("total_calls"),
        ).where(UsageRecord.tenant_id == tenant_id)
    )
    row = result.one()

    result = await db.execute(
        select(
            UsageRecord.model,
            func.sum(UsageRecord.total_tokens).label("tokens"),
            func.count(UsageRecord.id).label("calls"),
        )
        .where(UsageRecord.tenant_id == tenant_id)
        .group_by(UsageRecord.model)
    )
    by_model = [{"model": r[0], "tokens": r[1] or 0, "calls": r[2]} for r in result.all()]

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one()

    return {
        "tenant_id": tenant_id,
        "total_tokens": row.total_tokens or 0,
        "prompt_tokens": row.prompt_tokens or 0,
        "completion_tokens": row.completion_tokens or 0,
        "total_calls": row.total_calls or 0,
        "token_limit": tenant.token_limit,
        "usage_percent": round((row.total_tokens or 0) / tenant.token_limit * 100, 2) if tenant.token_limit else 0,
        "by_model": by_model,
    }