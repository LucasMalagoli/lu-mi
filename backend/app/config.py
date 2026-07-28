from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "proj-lu-mi-backend"
    database_url: str = Field(validation_alias="ASYNC_DATABASE_URL")
    job_search_cache_ttl_minutes: int = 60
    openrouter_api_key: Optional[str] = Field(default=None, validation_alias="OPENROUTER_API_KEY")
    openrouter_model: str = "openai/gpt-4o-mini"

    class Config:
        env_file = ".env"


settings = Settings()
