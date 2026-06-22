from pydantic import BaseModel


class Diagnosis(BaseModel):
    root_cause: str = ""
    explanation: str = ""
    suggested_fix: str = ""
    kubectl_command: str = ""
    prevention_recommendation: str = ""
    confidence: int = 0
    ai_error: str = ""
