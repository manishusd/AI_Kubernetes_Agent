import re

from app.kubernetes.executor import KubectlExecutor

LOG_TAIL_LINES = 80
MAX_SNIPPET_LINES = 25

LOG_PATTERNS = {
    "exception": re.compile(r"(?i)(exception|traceback|panic|fatal error)"),
    "connection_failure": re.compile(r"(?i)(connection refused|connection reset|timeout|unable to connect|dial tcp)"),
    "missing_env": re.compile(r"(?i)(env|environment variable|required.*not set|missing.*variable)"),
    "image_failure": re.compile(r"(?i)(imagepullbackoff|failed to pull|manifest unknown|not found.*image)"),
    "startup_error": re.compile(r"(?i)(failed to start|startup probe failed|crash|exit code|error loading)"),
}


class LogsCollector:
    """Collect concise logs from failed pods."""

    def __init__(self, executor: KubectlExecutor | None = None) -> None:
        self.executor = executor or KubectlExecutor()

    def collect(self, problematic_pods: list[dict]) -> dict:
        if not problematic_pods:
            return {
                "pods_checked": 0,
                "collected_logs": [],
                "pods_without_logs": [],
            }

        collected_logs: list[dict] = []
        pods_without_logs: list[dict] = []

        for pod in problematic_pods:
            name = pod["name"]
            namespace = pod["namespace"]

            result = self.executor.run(
                "logs",
                name,
                "-n",
                namespace,
                f"--tail={LOG_TAIL_LINES}",
                timeout=30,
            )

            if not result.success or not result.stdout.strip():
                pods_without_logs.append(
                    {
                        "name": name,
                        "namespace": namespace,
                        "reason": result.error or "No logs available",
                    }
                )
                continue

            highlights = self._extract_highlights(result.stdout)
            collected_logs.append(
                {
                    "pod": name,
                    "namespace": namespace,
                    "status": pod.get("status", "Unknown"),
                    "log_snippet": self._trim_log_snippet(result.stdout),
                    "highlights": highlights,
                }
            )

        return {
            "pods_checked": len(problematic_pods),
            "collected_logs": collected_logs,
            "pods_without_logs": pods_without_logs,
        }

    def _extract_highlights(self, log_text: str) -> list[str]:
        highlights: list[str] = []
        seen: set[str] = set()

        for line in log_text.splitlines():
            stripped = line.strip()
            if not stripped or stripped in seen:
                continue

            for pattern in LOG_PATTERNS.values():
                if pattern.search(stripped):
                    highlights.append(stripped[:200])
                    seen.add(stripped)
                    break

            if len(highlights) >= 8:
                break

        return highlights

    def _trim_log_snippet(self, log_text: str) -> str:
        lines = [line for line in log_text.splitlines() if line.strip()]
        if len(lines) <= MAX_SNIPPET_LINES:
            return "\n".join(lines)
        return "\n".join(lines[-MAX_SNIPPET_LINES:])
