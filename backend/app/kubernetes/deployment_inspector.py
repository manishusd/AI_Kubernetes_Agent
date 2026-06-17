from app.kubernetes.executor import KubectlExecutor


class DeploymentInspector:
    """Inspect deployments for rollout and replica issues."""

    def __init__(self, executor: KubectlExecutor | None = None) -> None:
        self.executor = executor or KubectlExecutor()

    def inspect(self) -> dict:
        result = self.executor.run("get", "deployments", "-A", "-o", "json", parse_json=True)

        if not result.success:
            return {
                "healthy": True,
                "total_deployments": 0,
                "unhealthy_deployments": [],
                "error": result.error,
            }

        items = result.data.get("items", []) if result.data else []
        unhealthy_deployments: list[dict] = []

        for deployment in items:
            issue = self._inspect_deployment(deployment)
            if issue:
                unhealthy_deployments.append(issue)

        return {
            "healthy": len(unhealthy_deployments) == 0,
            "total_deployments": len(items),
            "unhealthy_deployments": unhealthy_deployments,
        }

    def _inspect_deployment(self, deployment: dict) -> dict | None:
        metadata = deployment.get("metadata", {})
        spec = deployment.get("spec", {})
        status = deployment.get("status", {})

        desired_replicas = spec.get("replicas", 1)
        available_replicas = status.get("availableReplicas", 0)
        unavailable_replicas = status.get("unavailableReplicas", 0)
        updated_replicas = status.get("updatedReplicas", 0)

        issues: list[str] = []
        conditions_summary: list[dict] = []

        for condition in status.get("conditions", []):
            condition_type = condition.get("type", "Unknown")
            condition_status = condition.get("status", "Unknown")
            conditions_summary.append(
                {
                    "type": condition_type,
                    "status": condition_status,
                    "reason": condition.get("reason", ""),
                    "message": condition.get("message", ""),
                }
            )

            if condition_status != "True" and condition_type in {"Available", "Progressing"}:
                reason = condition.get("reason", condition_type)
                issues.append(f"{condition_type}={condition_status} ({reason})")

        if unavailable_replicas > 0:
            issues.append(f"unavailable_replicas={unavailable_replicas}")

        if available_replicas < desired_replicas:
            issues.append(f"available_replicas={available_replicas}/{desired_replicas}")

        if updated_replicas < desired_replicas:
            issues.append(f"updated_replicas={updated_replicas}/{desired_replicas}")

        if not issues:
            return None

        return {
            "name": metadata.get("name", "unknown"),
            "namespace": metadata.get("namespace", "default"),
            "desired_replicas": desired_replicas,
            "available_replicas": available_replicas,
            "unavailable_replicas": unavailable_replicas,
            "updated_replicas": updated_replicas,
            "issues": issues,
            "conditions": conditions_summary,
        }
