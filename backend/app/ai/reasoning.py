from __future__ import annotations

import json
import re
import time
from typing import Any

import httpx
from loguru import logger

from app.core.config import settings
from app.models.diagnosis import Diagnosis

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
MAX_RESPONSE_TOKENS = 700
RETRY_COUNT = 3

SYSTEM_INSTRUCTIONS = """
You are a Senior Kubernetes SRE. Analyze the following Kubernetes investigation data and reason like a senior on-call engineer.
Use the evidence to correlate Pod status, Logs, Events, Deployment health, and Networking findings.
Return the answer as valid JSON only, with exactly these keys:
- root_cause
- explanation
- suggested_fix
- kubectl_command
- prevention_recommendation
- confidence
Do not include any prose outside the JSON object.
"""


def _format_section(title: str, payload: Any) -> str:
    if not payload:
        return f"{title}: none"

    try:
        body = json.dumps(payload, indent=2, sort_keys=True)
    except (TypeError, ValueError):
        body = str(payload)

    return f"{title}:\n{body}"


def build_prompt(investigation_payload: dict) -> str:
    parts = [
        _format_section("Pod Status", investigation_payload.get("pods")),
        _format_section("Logs", investigation_payload.get("logs")),
        _format_section("Events", investigation_payload.get("events")),
        _format_section("Deployment Health", investigation_payload.get("deployments")),
        _format_section("Networking Findings", investigation_payload.get("network")),
    ]

    return "\n\n".join([
        "Analyze the Kubernetes investigation payload below and provide a senior SRE diagnosis.",
        "Use the evidence from each section to correlate the failure, identify the root cause, and suggest a practical fix.",
        *parts,
        "Respond with valid JSON only. Do not add any explanation outside the JSON object.",
    ])


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.openrouter_api_key
        self.model = model or settings.openrouter_model or DEFAULT_MODEL

    def complete(self, prompt: str) -> dict:
        if not self.api_key:
            raise ValueError("OpenRouter API key is missing. Set OPENROUTER_API_KEY in environment.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.0,
            "max_tokens": MAX_RESPONSE_TOKENS,
        }

        timeout = httpx.Timeout(30.0, connect=10.0)
        for attempt in range(RETRY_COUNT):
            try:
                with httpx.Client(timeout=timeout) as client:
                    response = client.post(OPENROUTER_URL, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as exc:
                logger.error("OpenRouter API failure status=%s body=%s", exc.response.status_code, exc.response.text)
            except httpx.RequestError as exc:
                logger.error("OpenRouter request failed: %s", exc)

            if attempt < RETRY_COUNT - 1:
                delay = 2**attempt
                logger.info("Retrying OpenRouter request in %s seconds", delay)
                time.sleep(delay)

        raise RuntimeError("Failed to get a response from OpenRouter after retries.")


def _normalize_json_text(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def _extract_fields(raw_text: str) -> dict:
    if not isinstance(raw_text, str):
        raw_text = str(raw_text)

    text = _normalize_json_text(raw_text)
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            # Normalize common field aliases returned by LLMs.
            return {
                "root_cause": payload.get("root_cause")
                or payload.get("rootCause")
                or payload.get("root cause")
                or "",
                "explanation": payload.get("explanation") or payload.get("analysis") or "",
                "suggested_fix": payload.get("suggested_fix")
                or payload.get("suggestedFix")
                or payload.get("suggested fix")
                or payload.get("fix")
                or "",
                "kubectl_command": payload.get("kubectl_command")
                or payload.get("kubectlCommand")
                or payload.get("kubectl command")
                or payload.get("command")
                or "",
                "prevention_recommendation": payload.get("prevention_recommendation")
                or payload.get("preventionRecommendation")
                or payload.get("prevention recommendation")
                or payload.get("prevention")
                or "",
                "confidence": payload.get("confidence")
                or payload.get("confidence_score")
                or payload.get("confidenceScore")
                or payload.get("confidence_level")
                or payload.get("confidenceLevel")
                or payload.get("confidence_percent")
                or payload.get("confidencePercent")
                or 0,
            }
        return {}
    except json.JSONDecodeError:
        logger.warning("AI response is not valid JSON; falling back to text parsing")

    fields = {}
    patterns = {
        "root_cause": r"root[_ ]cause\s*[:=-]\s*(.+)",
        "explanation": r"explanation\s*[:=-]\s*(.+)",
        "suggested_fix": r"suggested fix\s*[:=-]\s*(.+)",
        "kubectl_command": r"kubectl command[s]?\s*[:=-]\s*(.+)",
        "prevention_recommendation": r"prevention recommendation\s*[:=-]\s*(.+)",
        "confidence": r"confidence(?:[_ ](?:score|level|percent))?\s*[:=-]\s*([\d.]+)%?",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            fields[key] = match.group(1).strip()

    return fields


def _parse_reasoning_response(response: dict) -> dict:
    print("AI raw response:", json.dumps(response, indent=2, sort_keys=True))
    choices = response.get("choices") or []
    if not choices:
        raise ValueError("OpenRouter response contains no choices")

    choice = choices[0]
    message = choice.get("message") or choice
    content = message.get("content") if isinstance(message, dict) else str(message)
    print("AI response content:", repr(content))
    if not content:
        raise ValueError("OpenRouter response content is empty")

    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                text_part = part.get("text")
                if text_part:
                    parts.append(str(text_part))
            elif part:
                parts.append(str(part))
        normalized_content = "\n".join(parts)
    elif isinstance(content, dict):
        normalized_content = str(content.get("text") or content)
    else:
        normalized_content = str(content)

    return _extract_fields(normalized_content)


def _build_confidence(raw_confidence: Any) -> int:
    if raw_confidence is None:
        return 0
    parsed_value: float | None = None

    # Try direct numeric parse first (handles '0.8', '75', etc.)
    try:
        parsed_value = float(raw_confidence)
    except (TypeError, ValueError):
        text = str(raw_confidence).strip()

        # Map common textual confidence levels to percentage values
        text_lower = text.lower()
        textual_map = {
            "very high": 95,
            "high": 80,
            "likely": 75,
            "moderate": 50,
            "medium": 50,
            "low": 20,
            "very low": 5,
            "unlikely": 25,
            "unknown": 0,
            "none": 0,
            "certain": 95,
            "uncertain": 20,
        }

        for key, val in textual_map.items():
            if key in text_lower:
                return val

        # Extract percent or numeric digits from free-form text (e.g. "80%", "confidence: 0.8")
        percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
        if percent_match:
            parsed_value = float(percent_match.group(1))
        else:
            number_match = re.search(r"(\d+(?:\.\d+)?)", text)
            if number_match:
                parsed_value = float(number_match.group(1))
            else:
                return 0

    # Models may return confidence as 0-1 or 0-100. Normalize to integer percent.
    if parsed_value is None:
        return 0
    if 0 < parsed_value <= 1:
        parsed_value *= 100

    return max(0, min(100, int(round(parsed_value))))


def _normalize_string_field(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return " ".join(str(item) for item in value)
    if isinstance(value, dict):
        return json.dumps(value, indent=2, sort_keys=True)
    return str(value)


def _fallback_diagnosis(investigation_payload: dict, error_message: str | None = None) -> dict:
    pods = investigation_payload.get("pods", {})
    logs = investigation_payload.get("logs", {})
    deployments = investigation_payload.get("deployments", {})
    network = investigation_payload.get("network", {})

    root_cause = "Unable to determine a precise root cause from AI service."
    suggested_fix = "Inspect the Kubernetes evidence manually and check pod status, logs, events, deployment health, and network connectivity."
    prevention_recommendation = "Verify deployment environment variables, readiness probes, and resource configuration before applying changes."
    kubectl_command = "kubectl describe pods" if pods else "kubectl get pods"

    if pods.get("problematic_pods"):
        root_cause = "Pod(s) are unhealthy or failing startup."
        suggested_fix = "Review the failing pod logs and fix the application startup error or container configuration."
        kubectl_command = "kubectl logs <pod-name> --previous"

    if deployments.get("unhealthy_deployments"):
        suggested_fix = "Inspect the unhealthy deployment rollout and correct any image, environment, or replica configuration."
        kubectl_command = "kubectl rollout status deployment/<deployment-name>"

    if logs and isinstance(logs, dict) and any("error" in str(value).lower() for value in logs.values()):
        root_cause = "Application startup or runtime errors were detected in pod logs."

    if network.get("issues"):
        root_cause = "Networking issues were detected that may prevent traffic from reaching the application."
        suggested_fix = "Correct the reported service, endpoint, or network policy issues."
        kubectl_command = "kubectl get svc && kubectl get endpoints"

    fallback = {
        "root_cause": root_cause,
        "explanation": "The investigation payload shows Kubernetes evidence but the AI service did not return a valid diagnosis.",
        "suggested_fix": suggested_fix,
        "kubectl_command": kubectl_command,
        "prevention_recommendation": prevention_recommendation,
        "confidence": 0,
    }
    if error_message:
        fallback["ai_error"] = error_message

    return fallback


class AIReasoner:
    def __init__(self) -> None:
        self.client = OpenRouterClient()

    def reason(self, investigation_payload: dict) -> Diagnosis:
        prompt = build_prompt(investigation_payload)
        diagnosis_data: dict

        try:
            response = self.client.complete(prompt)
            diagnosis_data = _parse_reasoning_response(response)
        except Exception as exc:
            logger.error("AI reasoning failed: %s", exc)
            diagnosis_data = _fallback_diagnosis(investigation_payload, error_message=str(exc))

        return Diagnosis(
            root_cause=_normalize_string_field(diagnosis_data.get("root_cause", "")),
            explanation=_normalize_string_field(diagnosis_data.get("explanation", "")),
            suggested_fix=_normalize_string_field(diagnosis_data.get("suggested_fix", "")),
            kubectl_command=_normalize_string_field(diagnosis_data.get("kubectl_command", "")),
            prevention_recommendation=_normalize_string_field(diagnosis_data.get("prevention_recommendation", "")),
            confidence=_build_confidence(diagnosis_data.get("confidence", 0)),
            ai_error=_normalize_string_field(diagnosis_data.get("ai_error", "")),
        )