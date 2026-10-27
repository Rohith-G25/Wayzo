import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Get absolute path to the backend directory
BASE_DIR = Path(__file__).resolve().parent.parent
_BASE_DIR = BASE_DIR

class Settings(BaseSettings):
    # App Config
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # MongoDB Config
    MONGODB_URI: str = Field(default="mongodb://localhost:27017", env="MONGODB_URI")
    DATABASE_NAME: str = Field(default="smartroadai", env="DATABASE_NAME")
    
    # YOLO Config
    YOLO_MODEL_PATH: str = Field(default="ml/weights/best.pt", env="YOLO_MODEL_PATH")
    
    # Upload Storage Config
    UPLOAD_DIR: str = Field(default="uploads", env="UPLOAD_DIR")

    # Video Inspection Config
    MAX_VIDEO_UPLOAD_SIZE_MB: int = Field(default=100, env="MAX_VIDEO_UPLOAD_SIZE_MB")
    MAX_VIDEO_DURATION_SECONDS: int = Field(default=120, env="MAX_VIDEO_DURATION_SECONDS")
    VIDEO_SAMPLE_INTERVAL_SECONDS: float = Field(default=1.0, env="VIDEO_SAMPLE_INTERVAL_SECONDS")
    VIDEO_FRAME_MAX_DIMENSION: int = Field(default=960, env="VIDEO_FRAME_MAX_DIMENSION")

    # Security & Authentication Config
    JWT_SECRET_KEY: str = Field(
        default="512761d6bbf0083bf6b20927f1170946e572bf4013f336ddfe94e6dc35afc578",
        env="JWT_SECRET_KEY"
    )
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, env="REFRESH_TOKEN_EXPIRE_DAYS")
    MAX_FAILED_LOGIN_ATTEMPTS: int = Field(default=5, env="MAX_FAILED_LOGIN_ATTEMPTS")
    ACCOUNT_LOCKOUT_MINUTES: int = Field(default=15, env="ACCOUNT_LOCKOUT_MINUTES")
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        env="CORS_ORIGINS"
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return ["http://localhost:5173", "http://127.0.0.1:5173"]
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def BASE_DIR(self) -> Path:
        return _BASE_DIR

    @property
    def base_dir(self) -> Path:
        return _BASE_DIR

    @property
    def yolo_absolute_path(self) -> str:
        path = Path(self.YOLO_MODEL_PATH)
        if path.is_absolute():
            return str(path)
        return str(_BASE_DIR / path)

    @property
    def upload_absolute_dir(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        if path.is_absolute():
            return path
        return _BASE_DIR / path

    model_config = SettingsConfigDict(
        env_file=str(_BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate config
settings = Settings()
