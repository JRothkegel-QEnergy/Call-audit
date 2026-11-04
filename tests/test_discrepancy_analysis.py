"""Cuarta IA (paso 2): armado del pedido por motivo, lectura de la respuesta y validación de citas. Sin llamar a un
modelo."""

import pytest

from call_audit import discrepancy_analysis as analysis


def row(call_id: str, kind: str, quote: str = "Quiero renunciar al seguro.") -> dict:
    return {
        "call_id": call_id,
        "criterion_id": 25,
        "criterion_name": "No tipifica todas las gestiones",
        "kind": kind,
        "ai_call_verdict": "non_compliant",
        "excel_call_verdict": "compliant",
        "ai_fails": [25],
        "excel_fails": [],
        "ai_verdict": "non_compliant" if kind == "fp" else "compliant",
        "ai_confidence": 0.9,
        "ai_comment": "Gestionó dos seguros y tipificó uno.",
        "ai_quotes": [{"quote": quote, "startMs": 4000, "validated": True}] if kind != "fn" else [],
        "excel_comment": None,
        "excel_evaluator": None,
        "manual_item": None,
        "manual_call_verdict": None,
        "manual_notes": [],
        "manual_finding_notes": [],
        "rule": "No tipifica todas las gestiones.",
        "rule_prompt_version": "9.9",
        "typification": [{"mus_a_neto": "999", "outcome": "RETENCION", "reason": "Problemas Económicos"}],
        "holds_sec": None,
        "transcript_excerpt": [{"speaker": "customer", "startMs": 4000, "text": quote}] if kind != "fn" else [],
    }


TRANSCRIPTS = {"2001": [{"speaker": "agent", "startMs": 0, "text": "Le confirmo la renuncia de los dos seguros."}]}


def test_request_samples_each_kind_and_sends_full_call_only_for_fn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(analysis.SAMPLE, "fp", 2)
    rows = [row(f"10{i}", "fp") for i in range(5)] + [row("2001", "fn")]
    counts = analysis.criterion_counts(rows, n_calls=50)
    user, sent = analysis.build_request(25, rows, TRANSCRIPTS, counts)
    assert len(sent) == 3
    assert "fp · la IA marcó incumple y el cliente no (2 de 5)" in user
    assert "Transcripción completa:\n[00:00] EJECUTIVO: Le confirmo la renuncia de los dos seguros." in user
    assert "Notas sobre los datos" in user and "asume RETENCION" in user
    # La muestra es estable: mismo motivo, mismos casos.
    assert analysis.build_request(25, rows, TRANSCRIPTS, counts)[1] == sent


def test_parse_response_skips_text_and_code_fences() -> None:
    text = 'Aquí va:\n```json\n{"criterion_id": 25, "summary": "x", "patterns": []}\n```'
    assert analysis.parse_response(text)["criterion_id"] == 25
    with pytest.raises(ValueError):
        analysis.parse_response('{"criterios": []}')


def test_validate_quotes_against_what_the_model_received() -> None:
    sent = [row("1001", "fp"), row("2001", "fn")]
    result = {
        "patterns": [
            {
                "quotes": [
                    {"call_id": "1001", "text": "quiero renunciar al seguro"},
                    {"call_id": "2001", "text": "la renuncia de los dos seguros"},
                    {"call_id": "2001", "text": "una frase que nadie dijo"},
                ]
            }
        ]
    }
    assert analysis.validate_quotes(result, sent, TRANSCRIPTS) == 1
    assert [q["validated"] for q in result["patterns"][0]["quotes"]] == [True, True, False]
