"""Respaldo por OpenRouter cuando Gemini falla: capa 2 (bench.run_one) y ASR (run_providers). Sin APIs reales."""

import json
from pathlib import Path

import pytest

from call_audit.ingestion import pipeline
from call_audit.ingestion.import_bench import bench

PRIMARY = {
    "name": "gemini-3-8-flash",
    "provider": "gemini",
    "model": "gemini-3.8-flash",
    "fallback": "or-gemini-3-8-flash",
}


@pytest.fixture
def layer2(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    (tmp_path / "prompts").mkdir()
    (tmp_path / "prompts" / "call_1.txt").write_text("transcripción sintética", encoding="utf-8")
    monkeypatch.setattr(bench, "PROMPTS_DIR", tmp_path / "prompts")
    monkeypatch.setattr(bench, "RESULTS_DIR", tmp_path / "results")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test")

    def fake_call(cfg: dict, system: str, user: str) -> tuple[str, str, dict]:
        if cfg["provider"] == "gemini":
            raise RuntimeError("Error code: 402 - prepago sin saldo")
        return '{"ok": true}', cfg["model"], {"input_tokens": 10, "output_tokens": 5}

    monkeypatch.setattr(bench, "call_openai_compatible", fake_call)
    return tmp_path / "results" / PRIMARY["name"]


def test_layer2_uses_fallback_when_enabled(layer2: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(bench, "USE_FALLBACK", True)
    status = bench.run_one(PRIMARY, "call_1", "system", force=False)
    assert status.startswith("ok") and "respaldo or-gemini-3-8-flash" in status
    meta = json.loads((layer2 / "call_1.meta.json").read_text(encoding="utf-8"))
    assert meta["name"] == "gemini-3-8-flash"
    assert (meta["provider"], meta["requested_model"]) == ("openrouter", "google/gemini-3.8-flash")
    assert meta["fallback_from"] == "gemini-3.8-flash"
    assert not (layer2 / "call_1.error.txt").exists()


def test_layer2_bench_does_not_fall_back(layer2: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(bench, "USE_FALLBACK", False)
    assert bench.run_one(PRIMARY, "call_1", "system", force=False).startswith("ERROR")
    assert not (layer2 / "call_1.json").exists()


def test_layer2_without_openrouter_key_keeps_error(layer2: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(bench, "USE_FALLBACK", True)
    monkeypatch.delenv("OPENROUTER_API_KEY")
    assert bench.run_one(PRIMARY, "call_1", "system", force=False).startswith("ERROR")


@pytest.fixture
def asr(monkeypatch: pytest.MonkeyPatch):
    module = pipeline.load_asr()
    monkeypatch.setenv("OPENROUTER_API_KEY", "test")
    monkeypatch.setattr(module, "audio_seconds", lambda audio: 60.0)

    def gemini_down(audio: Path) -> dict:
        raise RuntimeError("HTTP Error 402: Payment Required")

    def openrouter_ok(audio: Path) -> dict:
        return {"segments": [{"start": 0, "speaker": "ejecutivo", "text": "hola"}], "usage": {"cost": 0.01}}

    monkeypatch.setitem(module.PROVIDERS, "gemini_3.8-flash", gemini_down)
    monkeypatch.setitem(module.PROVIDERS, "openrouter_gemini-3.8-flash", openrouter_ok)
    return module


def test_asr_fallback_keeps_primary_name(asr, tmp_path: Path) -> None:
    summary = asr.run_providers(
        tmp_path / "call_1.mp3", ["gemini_3.8-flash"], tmp_path / "out", log=lambda m: None, fallback=True
    )
    assert summary[0]["error"] is None and summary[0]["fallback_provider"] == "openrouter_gemini-3.8-flash"
    assert json.loads((tmp_path / "out" / "gemini_3.8-flash.json").read_text(encoding="utf-8"))["segments"]


def test_asr_without_fallback_reports_error(asr, tmp_path: Path) -> None:
    summary = asr.run_providers(tmp_path / "call_1.mp3", ["gemini_3.8-flash"], tmp_path / "out", log=lambda m: None)
    assert "402" in summary[0]["error"] and "fallback_provider" not in summary[0]
