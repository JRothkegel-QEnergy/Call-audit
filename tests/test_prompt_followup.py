"""Reglas del análisis aplicadas al prompt.yaml sin IA (Cambio 18 §8.4). prompt.yaml sintético."""

import yaml

from call_audit import prompt_followup as pf

SPEC = """# Prompt sintético: este comentario se conserva.
version: "2.10"
date: "2026-10-22"

origins:
  official_text:
    label: Texto oficial
    description: Texto oficial.

# Secciones
sections:
  - id: rubric
    heading: "## Pauta"
    items:
    - id: m13
      number: 13
      official: |-
        No indica número de seguro.
      criterion: |-
        debe decir el N° de seguro; bastan los 4
        últimos dígitos. Decir el N° de póliza no basta.
      history:
        - {version: "1.1", origin: official_text, note: "Texto oficial."}
    - id: m30
      number: 30
      official: |-
        No reitera protocolo de cierre.
      history:
        - {version: "1.1", origin: official_text, note: "Texto oficial."}
"""


def rule(cid: int, action: str | None, text: str, find: str | None = None, pid: str = "p1") -> pf.Rule:
    return pf.Rule(pid, cid, action, find, text, f'Patrón #1 · aceptada por Admin: nota "{pid}"')


def run(rules: list[pf.Rule], overrides: dict[int, str] | None = None) -> tuple[dict, list[dict], str]:
    text, criteria = pf.build(SPEC, "2.11", "2026-11-06", rules, overrides or {})
    return yaml.safe_load(text), criteria, text


def criterion(spec: dict, cid: int) -> str:
    return pf.criteria_of(spec)[cid].get("criterion") or ""


def test_replace_finds_the_phrase_across_line_breaks() -> None:
    spec, (c,), text = run([rule(13, "replace", "bastan los 3 últimos dígitos", "bastan los 4 últimos dígitos")])
    assert c["rules"][0]["state"] == "applied"
    assert (
        criterion(spec, 13)
        == "debe decir el N° de seguro; bastan los 3 últimos dígitos. Decir el N° de póliza no basta."
    )
    history = pf.criteria_of(spec)[13]["history"]
    assert history[-1] == {
        "version": "2.11",
        "origin": "discrepancy_analysis",
        "note": 'Patrón #1 · aceptada por Admin: nota "p1"',
    }
    # Lo demás del archivo queda igual: comentarios, versión, fecha y el origen nuevo.
    assert text.startswith('# Prompt sintético: este comentario se conserva.\nversion: "2.11"\ndate: "2026-11-06"')
    assert "# Secciones" in text and spec["origins"]["discrepancy_analysis"]["label"] == "Análisis de discrepancias"


def test_replace_needs_exactly_one_match() -> None:
    _, (c,), _ = run([rule(13, "replace", "x", "Bastan los 4 últimos dígitos")])
    assert c["rules"][0]["state"] == "review" and "No se encontró" in c["rules"][0]["reviewReason"]
    assert c["after"] == c["before"]
    _, (c,), _ = run([rule(13, "replace", "x", "N°")])
    assert c["rules"][0]["state"] == "review" and "aparece 2 veces" in c["rules"][0]["reviewReason"]


def test_append_free_text_and_missing_criterion() -> None:
    rules = [
        rule(13, "append", "Si dice el N° completo, también cumple.", pid="a"),
        rule(13, None, "Texto libre de una propuesta antigua.", pid="b"),
        rule(30, "append", "Debe repreguntar si el cliente no dice sí.", pid="c"),
    ]
    spec, (m13, m30), _ = run(rules)
    assert [r["state"] for r in m13["rules"]] == ["applied", "free_text"]
    assert criterion(spec, 13).endswith(
        "no basta.\nSi dice el N° completo, también cumple.\nTexto libre de una propuesta antigua."
    )
    assert m30["before"] == "" and criterion(spec, 30) == "Debe repreguntar si el cliente no dice sí."
    assert len(pf.criteria_of(spec)[13]["history"]) == 3


def test_manual_edit_resolves_review_and_unknown_motive() -> None:
    rules = [rule(13, "replace", "x", "no está"), rule(7, "append", "Algo.", pid="z")]
    spec, (m7, m13), _ = run(rules, {13: "Texto final escrito a mano."})
    assert m13["manual"] and m13["rules"][0]["state"] == "manual"
    assert criterion(spec, 13) == "Texto final escrito a mano."
    assert m7["rules"][0]["state"] == "review" and "no está en la versión vigente" in m7["rules"][0]["reviewReason"]


def test_next_version_skips_taken() -> None:
    assert pf.next_version("2.10", {"2.10"}) == "2.11"
    assert pf.next_version("2.10", {"2.10", "2.11"}) == "2.12"
