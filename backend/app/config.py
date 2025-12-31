from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "proj-lu-mi-backend"
    redis_url: str

    class Config:
        env_file = ".env"


settings = Settings()
