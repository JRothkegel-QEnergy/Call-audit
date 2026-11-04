"""Tabla de discrepancias (paso 1 de la cuarta IA) sobre la corrida sintética de conftest."""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import discrepancies
from call_audit.persistence.models import Case, DiscrepancyClassification, Note, User


def mark(session: Session, call_id: str, fails: list[int], evaluator: str | None = None) -> Case:
    case = session.scalar(select(Case).where(Case.call_id == call_id))
    case.external_item_fails = fails
    case.call_metadata = {**case.call_metadata, "external_evaluator": evaluator}
    return case


def test_kinds_cross_ai_with_client_marks() -> None:
    assert discrepancies.kind_of("non_compliant", False) == "fp"
    assert discrepancies.kind_of("non_compliant", True) == "match_fail"
    assert discrepancies.kind_of("compliant", True) == "fn"
    assert discrepancies.kind_of("not_applicable", False) == "match_ok"
    assert discrepancies.kind_of("uncertain", True) == "ai_uncertain"


def test_sides_with() -> None:
    assert discrepancies.sides_with("non_compliant", ai_fail=True, excel_fail=False) == "ai"
    assert discrepancies.sides_with("compliant", ai_fail=True, excel_fail=False) == "excel"
    assert discrepancies.sides_with("compliant", ai_fail=False, excel_fail=False) == "none"
    assert discrepancies.sides_with(None, ai_fail=True, excel_fail=False) is None


def test_build_rows_with_manual_review_and_evaluators(imported: sessionmaker[Session], users: dict[str, User]) -> None:
    with imported() as session, session.begin():
        # 1002: la IA marca el 30 y el cliente el 8 → un fp y un fn. El supervisor dice que la IA acertó.
        case = mark(session, "1002", [8], evaluator="Nombre Real Evaluadora")
        session.add(
            DiscrepancyClassification(
                case_id=case.id, classification="ai_correct", criterion_ids=[30], updated_by_id=users["supervisor"].id
            )
        )
        session.add(
            Note(case_id=case.id, scope="finding", criterion_id=30, text="Bien marcado", author_id=users["auditor"].id)
        )
        mark(session, "1003", [12], evaluator="Otro Evaluador")
        mark(session, "1001", [])
    with imported() as session:
        rows, transcripts, summary = discrepancies.build(session, {})

    by_key = {(r["call_id"], r["criterion_id"]): r for r in rows}
    assert by_key[("1002", 30)]["kind"] == "fp"
    assert by_key[("1002", 8)]["kind"] == "fn"
    assert by_key[("1003", 12)]["kind"] == "match_fail"
    assert all(r["call_id"] != "1001" for r in rows)

    fp = by_key[("1002", 30)]
    assert fp["manual_flagged_criterion"] is True
    assert fp["manual_finding_notes"] == ["Bien marcado"]
    assert fp["rule"] and fp["rule_prompt_version"]
    # La IA rechaza, el cliente aprueba y el supervisor dice que la IA acertó.
    assert fp["manual_call_verdict"] == "non_compliant"
    assert fp["manual_call_sides_with"] == "ai"

    assert {r["excel_evaluator"] for r in rows} == {"Nombre Real Evaluadora", "Otro Evaluador"}
    assert set(transcripts) == {"1002", "1003"}
    assert summary["n_calls"] == 3


def test_calls_without_client_marks_are_skipped(imported: sessionmaker[Session], tmp_path: Path) -> None:
    with imported() as session:
        rows, _, summary = discrepancies.build(session, {})
    assert rows == []
    assert summary["skipped"]["sin marca por motivo del cliente"] == 3
    discrepancies.write_summary(tmp_path, rows, summary)
    assert "no trae EVALUADOR_CALIDAD" in (tmp_path / "summary.md").read_text(encoding="utf-8")
