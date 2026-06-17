from app.kubernetes.executor import KubectlExecutor


class NetworkInspector:
    """Inspect services, endpoints, and basic networking health."""

    def __init__(self, executor: KubectlExecutor | None = None) -> None:
        self.executor = executor or KubectlExecutor()

    def inspect(self) -> dict:
        services_result = self.executor.run("get", "svc", "-A", "-o", "json", parse_json=True)
        endpoints_result = self.executor.run("get", "endpoints", "-A", "-o", "json", parse_json=True)

        if not services_result.success:
            return {
                "healthy": True,
                "total_services": 0,
                "issues": [],
                "error": services_result.error,
            }

        services = services_result.data.get("items", []) if services_result.data else []
        endpoints_items = (
            endpoints_result.data.get("items", []) if endpoints_result.success and endpoints_result.data else []
        )

        endpoint_map = self._build_endpoint_map(endpoints_items)
        issues: list[dict] = []

        for service in services:
            service_issues = self._inspect_service(service, endpoint_map)
            issues.extend(service_issues)

        dns_related = [
            issue for issue in issues if issue.get("type") in {"missing_endpoints", "selector_mismatch"}
        ]

        return {
            "healthy": len(issues) == 0,
            "total_services": len(services),
            "issues": issues,
            "dns_related_issues": dns_related,
            "endpoints_error": endpoints_result.error if not endpoints_result.success else None,
        }

    def _build_endpoint_map(self, endpoints_items: list[dict]) -> dict[tuple[str, str], dict]:
        endpoint_map: dict[tuple[str, str], dict] = {}
        for endpoint in endpoints_items:
            metadata = endpoint.get("metadata", {})
            key = (metadata.get("namespace", "default"), metadata.get("name", ""))
            endpoint_map[key] = endpoint
        return endpoint_map

    def _inspect_service(self, service: dict, endpoint_map: dict[tuple[str, str], dict]) -> list[dict]:
        metadata = service.get("metadata", {})
        spec = service.get("spec", {})
        namespace = metadata.get("namespace", "default")
        name = metadata.get("name", "unknown")
        service_type = spec.get("type", "ClusterIP")
        selector = spec.get("selector") or {}

        if service_type == "ExternalName":
            return []

        if name == "kubernetes" and namespace == "default":
            return []

        endpoint = endpoint_map.get((namespace, name))
        subsets = endpoint.get("subsets", []) if endpoint else []
        ready_addresses = self._count_ready_addresses(subsets)

        issues: list[dict] = []

        if not selector:
            issues.append(
                {
                    "type": "missing_selector",
                    "service": name,
                    "namespace": namespace,
                    "message": "Service has no selector defined",
                }
            )
            return issues

        if ready_addresses == 0:
            selector_issue = self._check_selector_match(namespace, selector)
            if selector_issue:
                issues.append(
                    {
                        "type": "selector_mismatch",
                        "service": name,
                        "namespace": namespace,
                        "selector": selector,
                        "message": selector_issue,
                    }
                )
            else:
                issues.append(
                    {
                        "type": "missing_endpoints",
                        "service": name,
                        "namespace": namespace,
                        "selector": selector,
                        "message": "Service exists but has no ready endpoints",
                    }
                )

        return issues

    def _count_ready_addresses(self, subsets: list[dict]) -> int:
        total = 0
        for subset in subsets:
            total += len(subset.get("addresses", []))
        return total

    def _check_selector_match(self, namespace: str, selector: dict[str, str]) -> str | None:
        label_selector = ",".join(f"{key}={value}" for key, value in selector.items())
        result = self.executor.run(
            "get",
            "pods",
            "-n",
            namespace,
            "-l",
            label_selector,
            "-o",
            "json",
            parse_json=True,
        )

        if not result.success:
            return None

        matching_pods = result.data.get("items", []) if result.data else []
        if len(matching_pods) == 0:
            return "Service selector does not match any pods"

        return None
