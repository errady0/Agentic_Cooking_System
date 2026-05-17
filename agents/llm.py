"""
agents/llm.py
Single place to instantiate the LLM. All agents import from here.
"""
from langchain_groq import ChatGroq
from config import settings


def get_llm(temperature: float | None = None) -> ChatGroq:
    return ChatGroq(
        model=settings.LLM_MODEL,
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        api_key=settings.GROQ_API_KEY,
        reasoning_format="hidden"
    )
