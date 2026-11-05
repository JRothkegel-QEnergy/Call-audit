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


def test_requests_send_every_case_with_the_full_call() -> None:
    rows = [row(f"10{i}", "fp") for i in range(5)] + [row("2001", "fn")]
    rows[0]["agent_id"] = "E-17"
    counts = analysis.criterion_counts(rows, n_calls=50)
    requests = analysis.build_requests(25, rows, {**TRANSCRIPTS, "100": TRANSCRIPTS["2001"]}, counts)
    assert len(requests) == 1
    user, sent = requests[0]
    assert len(sent) == 6
    assert "fp · la IA marcó incumple y el auditor cumple (5)" in user
    assert "Excel" not in user and "cliente no" not in user
    assert "### Llamada 100 · fp\nEjecutivo: E-17 · auditor: sin dato" in user
    # Llamada completa también en los fp cuando hay transcripción; si no, el tramo.
    assert user.count("Transcripción completa:\n[00:00] EJECUTIVO: Le confirmo la renuncia") == 2
    assert "Tramo de la transcripción:" in user
    assert 'Datos de la llamada: {"tipificación": [{"mus_a_neto": "999"' in user
    assert "Notas sobre los datos" in user and "asume RETENCION" in user


def test_big_criterion_goes_in_batches_and_a_merge(monkeypatch: pytest.MonkeyPatch) -> None:
    long_call = [{"speaker": "agent", "startMs": 0, "text": "Buenas tardes. " * 400}]
    rows = [row(f"30{i:02d}", "fp") for i in range(12)]
    transcripts = {r["call_id"]: long_call for r in rows}
    counts = analysis.criterion_counts(rows, n_calls=50)
    monkeypatch.setattr(analysis, "BATCH_TOKENS", 10_000)
    requests = analysis.build_requests(25, rows, transcripts, counts)
    assert len(requests) > 1
    assert [r["call_id"] for _, sent in requests for r in sent] == sorted(r["call_id"] for r in rows)
    assert all(len(user) <= 10_000 * analysis.CHARS_PER_TOKEN for user, _ in requests)
    assert f"## Tanda 1 de {len(requests)}" in requests[0][0]
    merge = analysis.merge_request(25, rows[0], counts, [{"patterns": [{"title": "A"}]}, {"patterns": []}])
    assert "## Tanda 2 de 2" in merge and '"title": "A"' in merge
    tokens_in, tokens_out = analysis.estimate_tokens("s", "m", requests)
    assert tokens_out == analysis.EXPECTED_OUTPUT_TOKENS * (len(requests) + 1)


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
