from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    network: str = "finney"
    cache_ttl_seconds: int = 180
    taostats_max_requests_per_minute: int = 4
    taostats_min_request_interval: float = 13.0
    target_subnets: list[int] = [15, 23, 83]
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    taostats_api_key: str = ""
    taostats_base_url: str = "https://api.taostats.io"

    oro_base_url: str = "https://api.oroagents.com"
    trishool_api_url: str = "https://api.trishool.ai"
    wandb_api_key: str = ""
    wandb_entity: str = "toptensor-ai"
    wandb_project: str = "CliqueAI"


settings = Settings()
