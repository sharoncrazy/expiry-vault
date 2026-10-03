from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    RESEND_API_KEY: str
    EMAIL_FROM: str = "onboarding@resend.dev"

    class Config:
        env_file = ".env"

settings = Settings()