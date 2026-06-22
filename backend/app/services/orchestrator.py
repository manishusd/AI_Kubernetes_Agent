from app.services.investigation import InvestigationService


def run_investigation() -> dict:
    """Run the full Kubernetes investigation pipeline."""
    service = InvestigationService()
    return service.run()
