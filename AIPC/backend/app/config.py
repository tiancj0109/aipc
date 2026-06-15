"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "AIPC - AI评测中心"
    APP_VERSION: str = "1.0.2"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "mysql+pymysql://root:zhongxinyi@localhost:3306/aipc?charset=utf8mb4"

    # Redis
    REDIS_URL: str = "redis://127.0.0.1:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://127.0.0.1:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://127.0.0.1:6379/2"

    # Security
    SECRET_KEY: str = "aipc-secret-key-change-in-production"
    ENCRYPTION_KEY: str = "aipc-encryption-key-32bytes!!"  # Must be 32 bytes for AES-256

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
