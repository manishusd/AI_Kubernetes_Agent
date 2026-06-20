import json
import subprocess
from dataclasses import dataclass, field
from typing import Any

from loguru import logger

from app.core.config import settings


@dataclass
class KubectlResult:
    success: bool
    command: list[str]
    stdout: str
    stderr: str
    data: Any | None = None
    error: str | None = None


class KubectlExecutor:
    """Safely execute kubectl commands and return structured output."""

    DEFAULT_TIMEOUT_SECONDS = 60

    def __init__(self, kubeconfig_path: str | None = None, context: str | None = None) -> None:
        self.kubeconfig_path = kubeconfig_path or settings.kubeconfig_path or None
        self.context = context

    def _build_command(self, *args: str) -> list[str]:
        command = ["kubectl"]
        if self.kubeconfig_path:
            command.extend(["--kubeconfig", self.kubeconfig_path])
        if self.context:
            command.extend(["--context", self.context])
        command.extend(args)
        return command

    def run(self, *args: str, parse_json: bool = False, timeout: int | None = None) -> KubectlResult:
        command = self._build_command(*args)
        logger.info("Executing: {}", " ".join(command))

        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout or self.DEFAULT_TIMEOUT_SECONDS,
                check=False,
            )
        except FileNotFoundError:
            message = "kubectl not found. Install kubectl and ensure it is on PATH."
            logger.error(message)
            return KubectlResult(
                success=False,
                command=command,
                stdout="",
                stderr="",
                error=message,
            )
        except subprocess.TimeoutExpired:
            message = f"kubectl command timed out after {timeout or self.DEFAULT_TIMEOUT_SECONDS}s"
            logger.error(message)
            return KubectlResult(
                success=False,
                command=command,
                stdout="",
                stderr="",
                error=message,
            )

        success = completed.returncode == 0
        data: Any | None = None
        error: str | None = None

        if not success:
            error = completed.stderr.strip() or f"kubectl exited with code {completed.returncode}"
            logger.warning("kubectl failed: {}", error)
        elif parse_json:
            if completed.stdout.strip():
                try:
                    data = json.loads(completed.stdout)
                except json.JSONDecodeError as exc:
                    success = False
                    error = f"Failed to parse kubectl JSON output: {exc}"
                    logger.error(error)
            else:
                data = {}

        return KubectlResult(
            success=success,
            command=command,
            stdout=completed.stdout,
            stderr=completed.stderr,
            data=data,
            error=error,
        )
