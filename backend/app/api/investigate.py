from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from app.models.investigation import InvestigationPayload, InvestigationResponse
from app.services.investigation import InvestigationService


class InvestigationRequest(BaseModel):
    context: str | None = None


router = APIRouter(tags=["investigation"])


@router.post("/investigate", response_model=InvestigationResponse)
def investigate_cluster(request: InvestigationRequest) -> JSONResponse:
    try:
        service = InvestigationService(context=request.context)
        investigation_data, diagnosis = service.run_with_diagnosis()

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "investigation": InvestigationPayload(**investigation_data).dict(),
                "diagnosis": diagnosis.dict(),
            },
        )
    except Exception as exc:
        logger.exception("Investigation request failed")
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc)},
        )
