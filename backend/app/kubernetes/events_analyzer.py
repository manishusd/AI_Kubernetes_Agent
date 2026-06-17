from app.kubernetes.executor import KubectlExecutor

WATCH_EVENT_REASONS = {
    "FailedScheduling",
    "BackOff",
    "FailedMount",
    "FailedPull",
    "ErrImagePull",
    "Unhealthy",
}


class EventsAnalyzer:
    """Analyze Kubernetes events for troubleshooting signals."""

    def __init__(self, executor: KubectlExecutor | None = None) -> None:
        self.executor = executor or KubectlExecutor()

    def analyze(self) -> dict:
        result = self.executor.run("get", "events", "-A", "-o", "json", parse_json=True)

        if not result.success:
            return {
                "total_events": 0,
                "findings": [],
                "summary": {},
                "error": result.error,
            }

        items = result.data.get("items", []) if result.data else []
        findings: list[dict] = []
        summary: dict[str, int] = {}

        for event in items:
            reason = event.get("reason", "")
            if reason not in WATCH_EVENT_REASONS:
                continue

            involved = event.get("involvedObject", {})
            finding = {
                "reason": reason,
                "type": event.get("type", "Unknown"),
                "namespace": event.get("metadata", {}).get("namespace", "default"),
                "object_kind": involved.get("kind", "Unknown"),
                "object_name": involved.get("name", "unknown"),
                "message": event.get("message", ""),
                "count": event.get("count", 1),
            }
            findings.append(finding)
            summary[reason] = summary.get(reason, 0) + 1

        findings.sort(key=lambda item: item.get("count", 1), reverse=True)

        return {
            "total_events": len(items),
            "findings": findings[:50],
            "summary": summary,
        }
