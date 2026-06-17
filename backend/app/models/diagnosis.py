from pydantic import BaseModel


class Diagnosis(BaseModel):
    root_cause: str = ""
    suggested_fix: str = ""
    summary: str = ""
