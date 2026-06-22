from pydantic import BaseModel, Field

from app.models.diagnosis import Diagnosis


class InvestigationPayload(BaseModel):
    pods: dict = Field(default_factory=dict)
    logs: dict = Field(default_factory=dict)
    events: dict = Field(default_factory=dict)
    deployments: dict = Field(default_factory=dict)
    network: dict = Field(default_factory=dict)
    healthy: bool = False
    error: str | None = None


class InvestigationResponse(BaseModel):
    status: str
    investigation: InvestigationPayload
    diagnosis: Diagnosis = Field(default_factory=Diagnosis)
