"""LLM access layer.

Groq is used when a key is configured. Every response is schema-validated and
repaired once if the model returns malformed JSON. The demo engine is a
deterministic fallback so the application remains fully explorable offline.
"""
from __future__ import annotations

import asyncio
import json
import re
from functools import lru_cache
from typing import TypeVar

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from ..config import settings
from . import mock
from .prompts import SYSTEM_INVESTIGATOR

T = TypeVar("T", bound=BaseModel)


class AIProviderError(RuntimeError):
    """Raised when inference fails after retries (safe to show to the user)."""


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object in model response")
    return json.loads(text[start : end + 1])


class BaseProvider:
    name = "base"
    model = ""
    live = False

    def info(self) -> dict:
        return {"provider": self.name, "model": self.model, "live": self.live}

    async def json(self, prompt: str, schema: type[T], *, fast: bool = False,
                   system: str = SYSTEM_INVESTIGATOR) -> T:
        raise NotImplementedError

    async def text(self, prompt: str, *, system: str = SYSTEM_INVESTIGATOR) -> str:
        raise NotImplementedError


class GroqProvider(BaseProvider):
    name = "groq"
    live = True

    def __init__(self) -> None:
        from langchain_groq import ChatGroq

        common = dict(
            api_key=settings.groq_api_key,
            temperature=settings.ai_temperature,
            timeout=settings.ai_timeout_seconds,
            max_retries=2,
            reasoning_format="parsed",
            reasoning_effort="low",
        )
        self.model = settings.groq_model
        self.fast_model = settings.groq_fast_model
        self._primary = ChatGroq(model=settings.groq_model, max_tokens=5000, **common)
        self._fast = ChatGroq(model=settings.groq_fast_model, max_tokens=4000, **common)
        self.last_usage: dict = {}

    def _llm(self, fast: bool):
        return self._fast if fast else self._primary

    async def json(self, prompt: str, schema: type[T], *, fast: bool = False,
                   system: str = SYSTEM_INVESTIGATOR) -> T:
        llm = self._llm(fast).bind(response_format={"type": "json_object"})
        messages = [SystemMessage(content=system), HumanMessage(content=prompt)]
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                response = await llm.ainvoke(messages)
                usage = getattr(response, "usage_metadata", None) or {}
                if usage:
                    self.last_usage = usage
                raw = response.content if isinstance(response.content, str) else str(response.content)
                data = _extract_json(raw)
                return schema.model_validate(data)
            except (ValueError, json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                if attempt == 2:
                    break
                messages = messages[:2] + [
                    AIMessage(content=(raw if "raw" in locals() else "")[:1200]),
                    HumanMessage(
                        content=(
                            f"That response failed validation: {str(exc)[:600]}. "
                            f"Return ONLY a corrected JSON object matching the required schema."
                        )
                    ),
                ]
                await asyncio.sleep(0.8)
            except Exception as exc:  # rate limits / transport
                last_error = exc
                message = str(exc)
                if attempt == 2:
                    break
                wait = 8 * (attempt + 1) if "429" in message or "rate" in message.lower() else 2
                await asyncio.sleep(wait)

        raise AIProviderError(
            f"The language model could not produce a valid response ({type(last_error).__name__}). "
            f"Please retry or switch model. Detail: {str(last_error)[:300]}"
        )

    async def text(self, prompt: str, *, system: str = SYSTEM_INVESTIGATOR) -> str:
        response = await self._primary.ainvoke(
            [SystemMessage(content=system), HumanMessage(content=prompt)]
        )
        return (response.content or "").strip()


class DemoProvider(BaseProvider):
    name = mock.PROVIDER_NAME
    model = mock.MODEL_NAME
    live = False

    async def json(self, prompt: str, schema: type[T], *, fast: bool = False,
                   system: str = SYSTEM_INVESTIGATOR) -> T:
        await mock.demo_delay(0.45 if fast else 0.8)
        name = schema.__name__
        if name == "IntakeResult":
            return schema.model_validate(mock.INTAKE)  # type: ignore[return-value]
        if name == "WhysResult":
            return schema.model_validate(
                {"five_whys": mock.ANALYSIS["five_whys"], "causal_summary": mock.ANALYSIS["causal_summary"]}
            )  # type: ignore[return-value]
        if name == "FishboneResult":
            return schema.model_validate({"fishbone": mock.ANALYSIS["fishbone"]})  # type: ignore[return-value]
        if name == "RootCauseResult":
            return schema.model_validate(
                {"root_causes": mock.ANALYSIS["root_causes"], "gaps": mock.ANALYSIS["gaps"]}
            )  # type: ignore[return-value]
        if name == "CapaResult":
            return schema.model_validate(mock.CAPA)  # type: ignore[return-value]
        if name == "ReviewResult":
            return schema.model_validate(mock.REVIEW)  # type: ignore[return-value]
        if name == "ChatResult":
            return mock.chat(prompt, {})  # type: ignore[return-value]
        raise AIProviderError(f"Demo engine has no fixture for {name}")

    async def text(self, prompt: str, *, system: str = SYSTEM_INVESTIGATOR) -> str:
        await mock.demo_delay(0.3)
        return mock.email_text([], {})


@lru_cache
def get_provider() -> BaseProvider:
    if settings.provider_mode == "groq" and settings.groq_api_key.strip():
        return GroqProvider()
    return DemoProvider()


def provider_status() -> dict:
    provider = get_provider()
    info = provider.info()
    info["mode"] = settings.provider_mode
    if provider.live:
        reason = None
    elif settings.provider_mode == "mock":
        reason = "AI_PROVIDER=mock - using the deterministic demo engine."
    elif not settings.groq_api_key.strip():
        reason = "GROQ_API_KEY is not set - using the deterministic demo engine."
    else:
        reason = "Groq is not available - using the deterministic demo engine."
    info["fallback_reason"] = reason
    return info
