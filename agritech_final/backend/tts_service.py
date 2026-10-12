"""TTS service with high-quality multilingual local generation (gTTS) and
optional OpenAI TTS fallback. Audio is persisted on disk and served via
`/api/tts/{key}.mp3` so Expo / Web clients can stream a plain MP3 URL.
"""
from __future__ import annotations
import os
import re
import hashlib
import logging
from pathlib import Path
import emoji
import httpx

log = logging.getLogger("aquacrop.tts")

CACHE_DIR = Path(__file__).parent / "tts_cache"
CACHE_DIR.mkdir(exist_ok=True)


def clean_for_tts(text: str) -> str:
    text = emoji.replace_emoji(text, replace="")
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_lang(text: str) -> str:
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "te"
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"
    return "en"


def cache_key(text: str, voice: str, speed: float, model: str, fmt: str) -> str:
    return hashlib.sha256(f"{text}|{voice}|{speed}|{model}|{fmt}".encode()).hexdigest()


class TTSService:
    def __init__(self) -> None:
        self.key = os.getenv("OPENAI_API_KEY") or os.getenv("EMERGENT_LLM_KEY")

    def _generate_local(self, text: str, path: Path, lang: str = "en") -> None:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang)
        tts.save(str(path))

    async def synthesize(
        self,
        text: str,
        voice: str = "nova",
        model: str = "tts-1-hd",
        speed: float = 1.0,
    ) -> str:
        cleaned = clean_for_tts(text)[:3800]
        if not cleaned:
            raise ValueError("empty text")
        key = cache_key(cleaned, voice, speed, model, "mp3")
        path = CACHE_DIR / f"{key}.mp3"
        if not path.exists():
            lang = detect_lang(cleaned)
            generated = False

            # If a real OpenAI key (not the dummy emergent placeholder) is provided, try OpenAI first:
            if self.key and not self.key.startswith("sk-emergent"):
                try:
                    headers = {
                        "Authorization": f"Bearer {self.key}",
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "model": model,
                        "input": cleaned,
                        "voice": voice,
                        "speed": speed,
                        "response_format": "mp3",
                    }
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        r = await client.post("https://api.openai.com/v1/audio/speech", headers=headers, json=payload)
                        if r.status_code == 200:
                            path.write_bytes(r.content)
                            generated = True
                        else:
                            log.warning("OpenAI TTS returned %s: %s; falling back to local TTS", r.status_code, r.text)
                except Exception as e:
                    log.warning("OpenAI TTS attempt failed: %s; falling back to local TTS", e)

            # Local multilingual speech generation (no API key required, reliable, free)
            if not generated:
                self._generate_local(cleaned, path, lang=lang)

        return key

    def audio_path(self, key: str) -> Path:
        return CACHE_DIR / f"{key}.mp3"
