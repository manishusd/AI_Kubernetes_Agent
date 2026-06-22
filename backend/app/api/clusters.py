from fastapi import APIRouter
import subprocess
from typing import Any

from app.core.config import settings

router = APIRouter(tags=["clusters"])


@router.get("/clusters")
def list_clusters() -> list[dict[str, Any]]:
    command = ["kubectl"]
    if settings.kubeconfig_path:
        command.extend(["--kubeconfig", settings.kubeconfig_path])
    command.extend(["config", "get-contexts", "-o", "name"])

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            timeout=20,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        return []

    contexts = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
    return [
        {
            "name": context,
            "cluster": context,
            "description": f"Context: {context}",
        }
        for context in contexts
    ]
