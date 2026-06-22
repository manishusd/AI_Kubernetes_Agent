from loguru import logger

from app.ai.reasoning import AIReasoner
from app.kubernetes.deployment_inspector import DeploymentInspector
from app.kubernetes.events_analyzer import EventsAnalyzer
from app.kubernetes.executor import KubectlExecutor
from app.kubernetes.logs_collector import LogsCollector
from app.kubernetes.network_inspector import NetworkInspector
from app.kubernetes.pod_inspector import PodInspector
from app.models.diagnosis import Diagnosis


class InvestigationService:
    """Orchestrate Kubernetes evidence collection before AI reasoning."""

    def __init__(self, executor: KubectlExecutor | None = None, context: str | None = None) -> None:
        self.executor = executor or KubectlExecutor(context=context)
        self.pod_inspector = PodInspector(self.executor)
        self.logs_collector = LogsCollector(self.executor)
        self.events_analyzer = EventsAnalyzer(self.executor)
        self.deployment_inspector = DeploymentInspector(self.executor)
        self.network_inspector = NetworkInspector(self.executor)

    def run(self) -> dict:
        logger.info("Starting Kubernetes investigation")

        pods = self.pod_inspector.inspect()
        problematic_pods = pods.get("problematic_pods", [])
        logger.info("Pod inspection complete: {} problematic pods", len(problematic_pods))

        if problematic_pods:
            logs = self.logs_collector.collect(problematic_pods)
            logger.info("Log collection complete: {} log sets", len(logs.get("collected_logs", [])))

            events = self.events_analyzer.analyze()
            logger.info("Event analysis complete: {} findings", len(events.get("findings", [])))

            deployments = self.deployment_inspector.inspect()
            logger.info(
                "Deployment inspection complete: {} unhealthy deployments",
                len(deployments.get("unhealthy_deployments", [])),
            )
        else:
            logs = {
                "pods_checked": 0,
                "collected_logs": [],
                "pods_without_logs": [],
                "skipped": True,
                "reason": "No problematic pods found",
            }
            logger.info("Log collection skipped: all pods are healthy")

            events = {
                "total_events": 0,
                "findings": [],
                "summary": {},
                "skipped": True,
                "reason": "All pods are healthy; events skipped to avoid stale-noise diagnosis",
            }
            logger.info("Event analysis skipped: all pods are healthy")

            deployments = {
                "healthy": True,
                "total_deployments": 0,
                "unhealthy_deployments": [],
                "skipped": True,
                "reason": "All pods are healthy; deployment inspection skipped",
            }
            logger.info("Deployment inspection skipped: all pods are healthy")

        network = self.network_inspector.inspect()
        logger.info("Network inspection complete: {} issues", len(network.get("issues", [])))

        investigation_error = (
            pods.get("error")
            or (None if events.get("skipped") else events.get("error"))
            or (None if deployments.get("skipped") else deployments.get("error"))
            or network.get("error")
        )
        investigation = {
            "pods": pods,
            "logs": logs,
            "events": events,
            "deployments": deployments,
            "network": network,
            "healthy": pods.get("healthy", False)
            and (events.get("skipped") or not events.get("findings"))
            and (deployments.get("skipped") or not deployments.get("unhealthy_deployments"))
            and not network.get("issues"),
            "error": investigation_error,
        }

        logger.info("Kubernetes investigation finished")
        return investigation

    def run_with_diagnosis(self) -> tuple[dict, "Diagnosis"]:
        investigation = self.run()

        if self._is_no_active_issue(investigation):
            diagnosis = self._build_no_active_issue_diagnosis()
        else:
            diagnosis = AIReasoner().reason(investigation)

        return investigation, diagnosis

    def _is_no_active_issue(self, investigation: dict) -> bool:
        pods = investigation.get("pods", {})
        network = investigation.get("network", {})
        return len(pods.get("problematic_pods", [])) == 0 and len(network.get("issues", [])) == 0

    def _build_no_active_issue_diagnosis(self) -> Diagnosis:
        return Diagnosis(
            root_cause="No active Kubernetes issue detected.",
            explanation="All pods are running with no active networking issues in the current cluster snapshot.",
            suggested_fix="No immediate action required.",
            kubectl_command="kubectl get pods -A && kubectl get svc -A && kubectl get endpoints -A",
            prevention_recommendation="Continue monitoring rollouts, probes, and service endpoints.",
            confidence=95,
            ai_error="",
        )
