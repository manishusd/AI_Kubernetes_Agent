from fastapi import APIRouter

from app.models.investigation import InvestigationPayload, InvestigationResponse
from app.services.investigation import InvestigationService

router = APIRouter(tags=["investigation"])


@router.post("/investigate", response_model=InvestigationResponse)
def investigate_cluster() -> InvestigationResponse:
    service = InvestigationService()
    investigation_data = service.run()

    return InvestigationResponse(
        status="success",
        investigation=InvestigationPayload(**investigation_data),
    )
