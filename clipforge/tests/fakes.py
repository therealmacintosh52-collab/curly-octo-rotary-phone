"""Test doubles: a fake whisper model that yields word-timed segments from a script."""
from __future__ import annotations

from types import SimpleNamespace


def fake_words(script: str, start: float = 0.0, wps: float = 2.5, gap_after_sentence: float = 0.4) -> list[dict]:
    """Turn a script into word dicts with plausible timings (wps words/second)."""
    words = []
    t = start
    step = 1.0 / wps
    for w in script.split():
        words.append({"start": round(t, 3), "end": round(t + step * 0.85, 3), "word": w, "prob": 0.95})
        t += step
        if w.endswith((".", "!", "?")):
            t += gap_after_sentence
    return words


class FakeWhisperModel:
    """Mimics faster_whisper.WhisperModel.transcribe() output shapes."""

    def __init__(self, words: list[dict], language: str = "en", duration: float | None = None):
        self._words = words
        self.language = language
        self.duration = duration or (words[-1]["end"] if words else 0.0)

    def transcribe(self, path, **kwargs):
        # group into segments of ~8 words
        segs = []
        for i in range(0, len(self._words), 8):
            chunk = self._words[i:i + 8]
            segs.append(SimpleNamespace(
                start=chunk[0]["start"], end=chunk[-1]["end"],
                text=" " + " ".join(w["word"] for w in chunk),
                words=[SimpleNamespace(start=w["start"], end=w["end"], word=" " + w["word"], probability=w["prob"])
                       for w in chunk],
            ))
        info = SimpleNamespace(language=self.language, language_probability=0.97, duration=self.duration)
        return iter(segs), info


SCRIPT_90S = (
    "Welcome back to the channel. Today I want to talk about something nobody tells you about reselling. "
    "Here's the thing. Most people think the money is in finding cheap products. It's not. "
    "The biggest mistake I see is spending ten hours sourcing and zero hours on listings. "
    "So let me show you exactly what I do instead. First thing, I photograph everything in one batch. "
    "Second, I write titles with the exact keywords buyers search. That alone doubled my sales. "
    "Why does that work? Because the algorithm rewards relevance, not effort. "
    "Um, you know, it sounds simple but almost nobody does it consistently. "
    "Now the crazy part. I tested this across three hundred listings last month. "
    "The listings with keyword titles sold four times faster. Four times. That's insane. "
    "And the margins were the same, so the only difference was the title. "
    "Pay attention to this next bit because it's the secret most sellers miss. "
    "You need to check sold comps before you list, not after. Write this down. "
    "If you do nothing else from this video, do that one thing and watch what happens. "
    "Okay, so that's the strategy. Thanks for watching and I'll see you in the next one."
)
