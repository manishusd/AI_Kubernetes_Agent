from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ai-kubernetes-agent"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    openrouter_api_key: str = ""
    openrouter_model: str = ""
    kubeconfig_path: str = ""


settings = Settings()
