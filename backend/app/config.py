from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "proj-lu-mi-backend"
    database_url: str = Field(validation_alias="ASYNC_DATABASE_URL")

    class Config:
        env_file = ".env"


settings = Settings()
