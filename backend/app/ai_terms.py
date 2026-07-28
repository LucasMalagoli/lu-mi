import json
import re

import httpx

from .config import settings

OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"

_SYSTEM_PROMPT = (
    "Você é um assistente que gera termos de busca para vagas de emprego no Brasil. "
    "Dado um cargo, responda APENAS com um array JSON de 6 a 12 strings curtas: "
    "sinônimos, variações e termos em português e inglês comumente usados em títulos "
    "de vaga no mercado brasileiro para esse cargo. Não inclua explicações, markdown "
    "ou qualquer texto além do array JSON."
)


class AiNotConfiguredError(Exception):
    pass


class AiSuggestionError(Exception):
    pass


def _parse_terms(content: str) -> list[str]:
    cleaned = content.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [str(t).strip() for t in data if str(t).strip()][:12]
    except json.JSONDecodeError:
        pass
    parts = re.split(r"[,\n]", cleaned)
    return [p.strip(" -\"'") for p in parts if p.strip(" -\"'")][:12]


async def suggest_terms(cargo: str) -> list[str]:
    if not settings.openrouter_api_key:
        raise AiNotConfiguredError()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                OPENROUTER_API,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": f"Cargo: {cargo}"},
                    ],
                    "temperature": 0.3,
                },
            )
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AiSuggestionError(str(exc))

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise AiSuggestionError("Resposta inesperada do provedor de IA")

    terms = _parse_terms(content)
    if not terms:
        raise AiSuggestionError("Nenhum termo retornado pelo provedor de IA")
    return terms
