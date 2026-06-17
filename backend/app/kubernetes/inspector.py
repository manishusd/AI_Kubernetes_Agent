from app.kubernetes.deployment_inspector import DeploymentInspector
from app.kubernetes.events_analyzer import EventsAnalyzer
from app.kubernetes.executor import KubectlExecutor
from app.kubernetes.logs_collector import LogsCollector
from app.kubernetes.network_inspector import NetworkInspector
from app.kubernetes.pod_inspector import PodInspector

__all__ = [
    "DeploymentInspector",
    "EventsAnalyzer",
    "KubectlExecutor",
    "LogsCollector",
    "NetworkInspector",
    "PodInspector",
]


def inspect_pods() -> dict:
    return PodInspector().inspect()


def inspect_events() -> dict:
    return EventsAnalyzer().analyze()


def inspect_logs(problematic_pods: list[dict] | None = None) -> dict:
    return LogsCollector().collect(problematic_pods or [])
