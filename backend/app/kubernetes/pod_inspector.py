from datetime import datetime, timezone

from app.kubernetes.executor import KubectlExecutor

PROBLEMATIC_STATUSES = {
    "CrashLoopBackOff",
    "ImagePullBackOff",
    "ErrImagePull",
    "Error",
    "OOMKilled",
    "ContainerCreating",
    "CreateContainerConfigError",
    "InvalidImageName",
}

STUCK_CONTAINER_CREATING_MINUTES = 5


class PodInspector:
    """Inspect pod health and detect unhealthy workloads."""

    def __init__(self, executor: KubectlExecutor | None = None) -> None:
        self.executor = executor or KubectlExecutor()

    def inspect(self) -> dict:
        result = self.executor.run("get", "pods", "-A", "-o", "json", parse_json=True)

        if not result.success:
            return {
                "healthy": True,
                "total_pods": 0,
                "problematic_pods": [],
                "error": result.error,
            }

        items = result.data.get("items", []) if result.data else []
        problematic_pods: list[dict] = []

        for pod in items:
            issue = self._detect_pod_issue(pod)
            if issue:
                problematic_pods.append(
                    {
                        "name": pod["metadata"]["name"],
                        "namespace": pod["metadata"]["namespace"],
                        "status": issue,
                        "phase": pod.get("status", {}).get("phase", "Unknown"),
                    }
                )

        return {
            "healthy": len(problematic_pods) == 0,
            "total_pods": len(items),
            "problematic_pods": problematic_pods,
        }

    def _detect_pod_issue(self, pod: dict) -> str | None:
        status = pod.get("status", {})
        phase = status.get("phase", "")

        if phase == "Pending":
            return "Pending"

        if phase in {"Failed", "Unknown"}:
            return phase

        for container_status in status.get("containerStatuses", []):
            issue = self._inspect_container_status(container_status, pod)
            if issue:
                return issue

        for container_status in status.get("initContainerStatuses", []):
            issue = self._inspect_container_status(container_status, pod)
            if issue:
                return issue

        return None

    def _inspect_container_status(self, container_status: dict, pod: dict) -> str | None:
        state = container_status.get("state", {})
        waiting = state.get("waiting", {})
        waiting_reason = waiting.get("reason", "")

        if waiting_reason in PROBLEMATIC_STATUSES:
            if waiting_reason == "ContainerCreating" and not self._is_container_creating_stuck(pod):
                return None
            return waiting_reason

        terminated = container_status.get("lastState", {}).get("terminated", {})
        terminated_reason = terminated.get("reason", "")
        if terminated_reason in PROBLEMATIC_STATUSES:
            return terminated_reason

        return None

    def _is_container_creating_stuck(self, pod: dict) -> bool:
        created_at = pod.get("metadata", {}).get("creationTimestamp")
        if not created_at:
            return True

        created_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        age_minutes = (datetime.now(timezone.utc) - created_time).total_seconds() / 60
        return age_minutes >= STUCK_CONTAINER_CREATING_MINUTES
