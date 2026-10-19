from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from call_audit.ingestion.import_bench import import_reviews, import_run
from call_audit.persistence.models import Case, DiscrepancyClassification, ModelRun, User
from call_audit.rubric import Rubric
from tests.conftest import CATALOG


def case_by_call(session: Session, call_id: str) -> Case:
    return session.scalar(select(Case).where(Case.call_id == call_id))


def test_import_creates_cases_with_bench_verdicts(imported: sessionmaker[Session]) -> None:
    with imported() as session:
        assert session.scalar(select(func.count()).select_from(Case)) == 3
        approved, minor, rejected = (case_by_call(session, c).runs[0] for c in ("1001", "1002", "1003"))
        assert approved.verdict == "compliant"
        assert minor.verdict == "non_compliant" and minor.minor_only
        assert minor.applied_rule.startswith("Rechazo leve")
        assert rejected.verdict == "non_compliant" and not rejected.minor_only
        assert all(r.is_current and r.prompt_version == "9.9" for r in (approved, minor, rejected))


def test_import_computes_hold_finding_and_validates_quotes(imported: sessionmaker[Session]) -> None:
    with imported() as session:
        findings = {f["criterionId"]: f for f in case_by_call(session, "1002").runs[0].findings}
        assert findings[1]["verdict"] == "compliant"
        assert findings[30]["evidence"]["quoteValidated"] is True
        assert findings[30]["evidence"]["startMs"] == 4000


def test_import_masks_client_comment_and_builds_sheet(imported: sessionmaker[Session]) -> None:
    with imported() as session:
        case = case_by_call(session, "1002")
        assert "987654321" not in case.external_comment
        assert "[TELEFONO]" in case.external_comment
        sheet = case.product_sheets[0]
        assert sheet["productId"] == "P99"
        assert sheet["category"] == "RETENIBLE"
        assert {"label": "Plan", "value": "Plan A"} in sheet["callData"]


def test_reimport_is_idempotent(imported: sessionmaker[Session], bench_dir: tuple[Path, dict], rubric: Rubric) -> None:
    out, rows = bench_dir
    with imported() as session, session.begin():
        import_run(session, out, rows, CATALOG, rubric, "v9.9", current_model="modelo-a")
    with imported() as session:
        assert session.scalar(select(func.count()).select_from(ModelRun)) == 3


def test_second_label_becomes_current(
    imported: sessionmaker[Session], bench_dir: tuple[Path, dict], rubric: Rubric
) -> None:
    out, rows = bench_dir
    with imported() as session, session.begin():
        import_run(session, out, rows, CATALOG, rubric, "v9.9 corrida 2", current_model="modelo-a")
    with imported() as session:
        runs = case_by_call(session, "1001").runs
        assert len(runs) == 2
        assert [r.run_label for r in runs if r.is_current] == ["v9.9 corrida 2"]


def test_import_reviews_classifies_discrepancies(
    imported: sessionmaker[Session], users: dict[str, User], tmp_path: Path
) -> None:
    csv_path = tmp_path / "revision.csv"
    csv_path.write_text(
        "stem,llamada,mi_veredicto,nota\n"
        "call_1001,1001,APROBADA,\n"  # IA coincide con el cliente: no es discrepancia
        'call_1002,1002,RECHAZADA,"El motivo 30 es real"\n'
        "call_1003,1003,POR REVISAR,\n",
        encoding="utf-8",
    )
    with imported() as session, session.begin():
        assert import_reviews(session, csv_path, users["supervisor"].email) == 1
    with imported() as session:
        item = session.get(DiscrepancyClassification, case_by_call(session, "1002").id)
        assert item.classification == "ai_correct"
        assert item.presentation == "pending"
        assert item.note == "El motivo 30 es real"
