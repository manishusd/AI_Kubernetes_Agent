from loguru import logger

from app.kubernetes.deployment_inspector import DeploymentInspector
from app.kubernetes.events_analyzer import EventsAnalyzer
from app.kubernetes.executor import KubectlExecutor
from app.kubernetes.logs_collector import LogsCollector
from app.kubernetes.network_inspector import NetworkInspector
from app.kubernetes.pod_inspector import PodInspector


class InvestigationService:
    """Orchestrate Kubernetes evidence collection before AI reasoning."""

    def __init__(self, executor: KubectlExecutor | None = None) -> None:
        self.executor = executor or KubectlExecutor()
        self.pod_inspector = PodInspector(self.executor)
        self.logs_collector = LogsCollector(self.executor)
        self.events_analyzer = EventsAnalyzer(self.executor)
        self.deployment_inspector = DeploymentInspector(self.executor)
        self.network_inspector = NetworkInspector(self.executor)

    def run(self) -> dict:
        logger.info("Starting Kubernetes investigation")

        pods = self.pod_inspector.inspect()
        logger.info("Pod inspection complete: {} problematic pods", len(pods.get("problematic_pods", [])))

        logs = self.logs_collector.collect(pods.get("problematic_pods", []))
        logger.info("Log collection complete: {} log sets", len(logs.get("collected_logs", [])))

        events = self.events_analyzer.analyze()
        logger.info("Event analysis complete: {} findings", len(events.get("findings", [])))

        deployments = self.deployment_inspector.inspect()
        logger.info(
            "Deployment inspection complete: {} unhealthy deployments",
            len(deployments.get("unhealthy_deployments", [])),
        )

        network = self.network_inspector.inspect()
        logger.info("Network inspection complete: {} issues", len(network.get("issues", [])))

        investigation = {
            "pods": pods,
            "logs": logs,
            "events": events,
            "deployments": deployments,
            "network": network,
        }

        logger.info("Kubernetes investigation finished")
        return investigation
