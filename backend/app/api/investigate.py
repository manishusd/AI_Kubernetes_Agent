from fastapi import APIRouter
from pydantic import BaseModel

from app.models.investigation import InvestigationPayload, InvestigationResponse
from app.services.investigation import InvestigationService


class InvestigationRequest(BaseModel):
    context: str | None = None


router = APIRouter(tags=["investigation"])


@router.post("/investigate", response_model=InvestigationResponse)
def investigate_cluster(request: InvestigationRequest) -> InvestigationResponse:
    service = InvestigationService(context=request.context)
    investigation_data, diagnosis = service.run_with_diagnosis()

    return InvestigationResponse(
        status="success",
        investigation=InvestigationPayload(**investigation_data),
        diagnosis=diagnosis,
    )
