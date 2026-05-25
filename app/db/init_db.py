import asyncio
from app.db.base import engine, Base
from app.db.models import Tenant, User, ApiKey, AgentConfig, ChatSession, ChatMessage, UsageRecord


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")


if __name__ == "__main__":
    asyncio.run(init_db())