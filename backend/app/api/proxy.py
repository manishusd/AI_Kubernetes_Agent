from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import httpx

from app.core.config import settings

router = APIRouter(tags=["proxy"])


@router.post("/proxy/investigate")
async def proxy_investigate(request: Request) -> JSONResponse:
    target_url = f"http://localhost:8000/investigate"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(target_url, json=await request.json())
            response.raise_for_status()
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content={"detail": exc.response.text})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": str(exc)})
