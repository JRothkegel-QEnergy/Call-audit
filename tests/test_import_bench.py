import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from call_audit.ingestion.import_bench import Unmasker, hold_evidence, import_reviews, import_run
from call_audit.persistence.models import Case, DiscrepancyClassification, ModelRun, User
from call_audit.rubric import Rubric
from tests.conftest import CATALOG


def case_by_call(session: Session, call_id: str) -> Case:
    return session.scalar(select(Case).where(Case.call_id == call_id))


def test_import_creates_cases_with_bench_verdicts(imported: sessionmaker[Session]) -> None:
    with imported() as session:
        assert session.scalar(select(func.count()).select_from(Case)) == 3
        approved, closing, rejected = (case_by_call(session, c).runs[0] for c in ("1001", "1002", "1003"))
        assert approved.verdict == "compliant"
        # Pauta v1.0.1: todos los motivos son graves, también el 30.
        assert closing.verdict == "non_compliant" and not closing.minor_only
        assert closing.applied_rule == "Rechaza: incumple 30"
        assert rejected.verdict == "non_compliant" and not rejected.minor_only
        assert all(r.is_current and r.prompt_version == "9.9" for r in (approved, closing, rejected))


def test_hold_over_30_seconds_fails_motivo_1(
    db: sessionmaker[Session], bench_dir: tuple[Path, dict], rubric: Rubric
) -> None:
    out, rows = bench_dir
    call_path = out / "calls" / "call_1001.json"
    call = json.loads(call_path.read_text(encoding="utf-8"))
    call["metadata"]["holds_sec"] = [31]
    call_path.write_text(json.dumps(call), encoding="utf-8")
    with db() as session, session.begin():
        import_run(session, out, rows, CATALOG, rubric, "v9.9", "modelo-a")
    with db() as session:
        run = case_by_call(session, "1001").runs[0]
        assert rubric.hold_limit_sec == 30
        assert run.verdict == "non_compliant"
        assert next(f for f in run.findings if f["criterionId"] == 1)["verdict"] == "non_compliant"


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


def test_asr_dir_shows_original_transcript_and_raw_comment(
    db: sessionmaker[Session], bench_dir: tuple[Path, dict], rubric: Rubric, tmp_path: Path
) -> None:
    out, rows = bench_dir
    asr = tmp_path / "asr_bench"
    for recording in rows:
        (asr / recording).mkdir(parents=True)
        segments = [{"text": "Buenos días, habla Camila."}, {"text": "Soy Persona Inventada, mi RUT es 11111111-1."}]
        (asr / recording / "gemini_3.8-flash.json").write_text(json.dumps({"segments": segments}), encoding="utf-8")
    with db() as session, session.begin():
        import_run(session, out, rows, CATALOG, rubric, "v9.9", "modelo-a", asr_dir=asr)
    with db() as session:
        case = case_by_call(session, "1002")
        assert case.transcript[1]["text"] == "Soy Persona Inventada, mi RUT es 11111111-1."
        assert case.transcript[1]["startMs"] == 4000
        assert "987654321" in case.external_comment
        # Lo que se envió al modelo queda como salió (enmascarado en el bench).
        assert "Persona Inventada" not in case.runs[0].user_prompt


def test_unmasker_restores_quotes_and_comments() -> None:
    masked = ["Señora [NOMBRE_CLIENTE], ¿por qué desea renunciar?", "Mi RUT es [RUT] y mi fono [TELEFONO]."]
    original = ["Señora Lorena, ¿por qué desea renunciar?", "Mi RUT es 11 111 111-1 y mi fono 987654321."]
    unmask = Unmasker(masked, original)
    assert unmask("Señora [NOMBRE_CLIENTE], ¿por qué desea renunciar?") == "Señora Lorena, ¿por qué desea renunciar?"
    assert unmask("Mi RUT es [RUT] y mi fono") == "Mi RUT es 11 111 111-1 y mi fono"
    assert unmask("[NOMBRE_CLIENTE] pide renunciar... luego acepta") == "Lorena pide renunciar... luego acepta"
    assert unmask("Sin marcadores") == "Sin marcadores"


def test_unmasker_placeholder_at_the_edge() -> None:
    unmask = Unmasker(["Hablo con [NOMBRE_CLIENTE] hoy"], ["Hablo con Lorena hoy"])
    assert unmask("Hablo con [NOMBRE_CLIENTE]") == "Hablo con Lorena"


def test_hold_evidence_points_to_the_longest_executive_wait() -> None:
    segments = [
        {"speaker": "EJECUTIVO", "start": "00:00", "end": "00:02", "text": "Un momento, por favor."},
        {"speaker": "EJECUTIVO", "start": "00:49", "end": "00:52", "text": "Gracias por esperar, señora."},
        {"speaker": "CLIENTE", "start": "00:53", "end": "00:55", "text": "Bueno."},
    ]
    turns = [{"text": s["text"]} for s in segments]
    evidence = hold_evidence(segments, turns)
    assert evidence == {
        "quote": "Gracias por esperar, señora.",
        "startMs": 2000,
        "endMs": 49000,
        "quoteValidated": True,
    }
    assert hold_evidence(segments, turns[:2]) is None


def test_announced_hold_counts_even_if_the_client_talks_to_someone_else() -> None:
    import sys

    from call_audit.config import ROOT

    sys.path.insert(0, str(ROOT / "scripts" / "prompt_bench"))
    import real_calls

    segments = [
        {
            "speaker": "EJECUTIVO",
            "start": "02:23",
            "end": "02:26",
            "text": "Voy a revisar, permanezca en línea, por favor.",
        },
        {"speaker": "CLIENTE", "start": "02:26", "end": "02:27", "text": "Ya."},
        {"speaker": "CLIENTE", "start": "02:40", "end": "03:03", "text": "Mira, dice, mira. Hipopótamos."},
        {"speaker": "EJECUTIVO", "start": "03:04", "end": "03:10", "text": "Ya, perfecto. Me aparece su seguro."},
    ]
    assert real_calls.executive_holds(segments) == [38]
