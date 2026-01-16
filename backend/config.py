from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    tradier_token: str = "placeholder_token"
    risk_free_rate: float = 0.045
    dividend_yield: float = 0.0
    cache_ttl_seconds: int = 60
    allowed_origins: str = "http://localhost:5173"

    class Config:
        env_file = "backend/.env"

settings = Settings()