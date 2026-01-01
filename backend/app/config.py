from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "proj-lu-mi-backend"
    database_url: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/app_db"

    class Config:
        env_file = ".env"


settings = Settings()
