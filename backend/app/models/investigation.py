from pydantic import BaseModel, Field


class InvestigationPayload(BaseModel):
    pods: dict = Field(default_factory=dict)
    logs: dict = Field(default_factory=dict)
    events: dict = Field(default_factory=dict)
    deployments: dict = Field(default_factory=dict)
    network: dict = Field(default_factory=dict)


class InvestigationResponse(BaseModel):
    status: str
    investigation: InvestigationPayload
