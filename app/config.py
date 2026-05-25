from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Agent Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./agent_platform.db"

    # JWT
    JWT_SECRET_KEY: str = "agent-platform-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    # LLM Gateway
    LLM_GATEWAY_URL: str = "https://api.openai.com/v1"
    LLM_GATEWAY_API_KEY: str = ""
    LLM_DEFAULT_MODEL: str = "deepseek-chat"

    # Multi-model routing
    LLM_MODELS: dict = {
        "deepseek-chat": {
            "provider": "deepseek",
            "base_url": "https://api.deepseek.com/v1",
            "max_tokens": 8192,
        },
        "gpt-4o": {
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "max_tokens": 4096,
        },
        "claude-3-sonnet": {
            "provider": "anthropic",
            "base_url": "https://api.anthropic.com/v1",
            "max_tokens": 4096,
        },
    }

    # Tenant defaults
    TENANT_DEFAULT_TOKEN_LIMIT: int = 100000  # per month
    TENANT_DEFAULT_AGENT_LIMIT: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
