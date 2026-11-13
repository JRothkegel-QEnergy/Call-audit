"""Loop de mejora del prompt (docs/plan-loop-prompt.md) y acuerdo por colores del mosaico. Todo sintético: los modelos
de la capa 2 y del análisis son dobles."""

import json

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import agreement, discrepancy_runs, prompt_evaluation, prompt_followup, prompt_loop, prompt_registry
from call_audit.persistence.models import (
    Case,
    DiscrepancyPattern,
    PromptEvaluation,
    PromptLoop,
    PromptVersion,
    ProposalDecision,
    User,
)
from tests.test_discrepancy_runs import MODEL, admin  # noqa: F401 - fixture

SPLITS = {"1001": "train", "1002": "train", "1003": "val"}


def layer2(model: str, system: str, user: str) -> tuple[str, float, int]:
    audit = {"criterios": [{"id": 12, "estado": "incumple", "evidencia": [{"cita": "Quiero renunciar al seguro."}]}]}
    return json.dumps(audit), 0.002, 800


class Analysis:
    """Responde en orden: primero el análisis de entrenamiento, después el de causa en validación."""

    def __init__(self, *responses: dict) -> None:
        self.responses = list(responses)

    def __call__(self, cfg: dict, system: str, user: str) -> tuple[str, float]:
        return json.dumps(self.responses.pop(0), ensure_ascii=False), 0.03


def pattern(cid: int, call: str, cause: str, proposal: str | None) -> dict:
    return {
        "criterion_id": cid,
        "summary": "Sintético.",
        "patterns": [
            {
                "title": f"Patrón del motivo {cid}",
                "direction": "fp",
                "cause": cause,
                "cases": [call],
                "explanation": "Sintético.",
                "quotes": [],
                "proposal": {"type": "prompt_rule", "text": proposal} if proposal else None,
                "confidence": 0.7,
            }
        ],
        "observations": [],
        "unexplained_cases": [],
    }


@pytest.fixture
def loop_db(imported: sessionmaker[Session], admin: User, monkeypatch: pytest.MonkeyPatch) -> sessionmaker[Session]:  # noqa: F811
    monkeypatch.setattr(discrepancy_runs, "MIN_CASES", 1)
    with imported() as session, session.begin():
        for case in session.scalars(select(Case)):
            case.call_metadata = {**(case.call_metadata or {}), "golden_split": SPLITS[case.call_id]}
        prompt_registry.ensure_bootstrap(session)
    return imported


def test_one_round(loop_db: sessionmaker[Session], admin: User) -> None:  # noqa: F811
    with loop_db() as session, session.begin():
        base = prompt_registry.ensure_bootstrap(session).version
        prompt_loop.start(session, session.get(User, admin.id), base, rounds=1)

    # 1. Prueba en entrenamiento: todas las llamadas de entrenamiento (1001 y 1002), no solo las que estaban en
    # desacuerdo, para que se vean las regresiones.
    assert prompt_loop.advance(loop_db) == "vuelta 1: esperando la prueba en entrenamiento (0/2)"
    prompt_evaluation.process_pending(loop_db, caller=layer2)
    with loop_db() as session:
        train = session.scalar(select(PromptEvaluation).where(PromptEvaluation.purpose == "train"))
        assert train.status == "done" and train.split == "train" and "findings" in train.results[0]
        # No es la prueba de la versión ni le cambia el estado.
        assert prompt_evaluation.latest(session, base) is None
        assert session.get(PromptVersion, base).status == "active"

    # 2. Análisis de esa prueba: el motivo 12 en 1002 (la IA marca, el revisor no).
    assert prompt_loop.advance(loop_db) == "vuelta 1: esperando el análisis de entrenamiento"
    discrepancy_runs.process_pending(
        loop_db,
        caller=Analysis(pattern(12, "1002", "rule_text", "No marcar el 12 si el cliente solo pide renunciar.")),
    )

    # 3. Pausa hasta que el admin acepte la regla y cree la versión.
    assert "esperando que apruebes" in prompt_loop.advance(loop_db)
    with loop_db() as session, session.begin():
        assert prompt_loop.active(session).status == "waiting_approval"
        rules_run = discrepancy_runs.latest_finished(session)
        assert rules_run.purpose == "rules" and rules_run.source_evaluation_id == train.id
        (p,) = session.scalars(select(DiscrepancyPattern).where(DiscrepancyPattern.analysis_id == rules_run.id))
        actor = session.get(User, admin.id)
        discrepancy_runs.decide(session, p, actor, "accepted")
        preview = prompt_followup.preview(session, [p.id], {})
        assert preview["baseVersion"] == base and preview["baseIsActive"]

        # Una regla aceptada de un análisis de la corrida vigente no se mezcla con las del loop.
        def copy(row, **changes):
            cols = {c.name: getattr(row, c.name) for c in row.__table__.columns if c.name != "id"}
            clone = type(row)(**{**cols, **changes})
            session.add(clone)
            session.flush()
            return clone

        old_run = copy(rules_run, source_evaluation_id=None, purpose=None)
        old = copy(p, analysis_id=old_run.id)
        copy(session.scalar(select(ProposalDecision).where(ProposalDecision.pattern_id == p.id)), pattern_id=old.id)
        with pytest.raises(prompt_followup.FollowUpError) as exc:
            prompt_followup.preview(session, [p.id, old.id], {})
        assert exc.value.code == "mixed_base" and exc.value.errors == [base]
        session.delete(session.scalar(select(ProposalDecision).where(ProposalDecision.pattern_id == old.id)))
        session.delete(old)
        session.delete(old_run)
        session.flush()
        row, _ = prompt_followup.create(
            session,
            author=actor,
            base=base,
            proposal_ids=[p.id],
            overrides={},
            model=MODEL,
            changelog=preview["changelog"],
            rationale=None,
        )
        new = row.version
        # «Crear borrador y probar»: el admin ya lanzó la prueba; el loop no lanza otra.
        prompt_evaluation.start(session, row, actor)

    # 4. Prueba de la versión nueva en validación (la prueba normal).
    assert prompt_loop.advance(loop_db) == "vuelta 1: esperando la prueba en validación (0/1)"
    with loop_db() as session:
        assert len(session.scalars(select(PromptEvaluation).where(PromptEvaluation.version == new)).all()) == 1
    prompt_evaluation.process_pending(loop_db, caller=layer2)

    # 5. Análisis de causa en validación: 1003 tiene el motivo 30 que solo marcó el revisor, y el análisis lo
    # atribuye al auditor.
    assert prompt_loop.advance(loop_db) == "vuelta 1: esperando el análisis de causa"
    discrepancy_runs.process_pending(loop_db, caller=Analysis(pattern(30, "1003", "auditor", "Calibrar.")))
    assert prompt_loop.advance(loop_db) == "terminado"

    with loop_db() as session:
        loop = session.scalar(select(PromptLoop))
        out = prompt_loop.loop_out(session, loop)
        assert out["status"] == "done" and out["rounds"][0]["nextVersion"] == new
        assert out["spentUsd"] > 0
        val = prompt_evaluation.latest(session, new)
        assert val.loop_id == loop.id and session.get(PromptVersion, new).status == "tested"
        # El análisis de causa es el último análisis y sus propuestas se pueden decidir (F3, F4 de
        # docs/ux/admin-prompt-metrics/06-ajustes-feedback.md); el Resumen muestra su prueba de validación.
        attribution = agreement.attribution_of(session, val)
        assert discrepancy_runs.latest_finished(session).id == attribution.id
        assert rules_run.id != attribution.id
        (blue,) = session.scalars(select(DiscrepancyPattern).where(DiscrepancyPattern.analysis_id == attribution.id))
        assert discrepancy_runs.decide(session, blue, session.get(User, admin.id), "accepted").status == "accepted"
        from call_audit import verification

        assert verification.quality_for_analysis(session, attribution)["version"] == new
        # Cuadre (R1 A): la barra del Resumen, las dos columnas y el total salen de la misma fuente.
        from call_audit import discrepancy_insights

        ins = discrepancy_insights.insights(session, val)
        item = agreement.for_evaluation(session, val)["byCallCriterion"]
        assert ins["promptSide"]["n"] + ins["reviewerSide"]["n"] == ins["disagreements"]
        assert ins["disagreements"] == item["promptFn"] + item["promptFp"] + item["reviewer"]

        result = agreement.for_evaluation(session, val)
        assert result["causeAnalysis"]["status"] == "done"
        # 1003: el revisor rechazó y la IA también (por el 12) → acuerdo por llamada. Por motivo, el 30 es azul.
        assert result["byCall"] == {**agreement.empty(), "n": 1, "agree": 1, "approved": 0, "rejected": 1}
        item = result["byCallCriterion"]
        assert (item["reviewer"], item["reviewerFn"], item["promptFn"], item["promptFp"]) == (1, 1, 0, 0)
        assert item["n"] == result["criteria"] == item["agree"] + item["reviewer"]


def test_compute_colors_and_totals() -> None:
    criteria = [12, 30]
    results = [
        # IA aprueba, revisor rechaza por el 30: FN; el 30 es azul → la llamada es azul.
        {"caseId": "a", "verdict": "compliant", "external": "non_compliant", "externalFails": [30]},
        # IA rechaza por el 12, revisor aprueba: FP del prompt (el 12 no está atribuido).
        {"caseId": "b", "verdict": "non_compliant", "external": "compliant", "externalFails": [], "failCriteria": [12]},
        # IA dudosa en el 12.
        {
            "caseId": "c",
            "verdict": "uncertain",
            "external": "compliant",
            "externalFails": [],
            "uncertainCriteria": [12],
        },
        # Con error: no cuenta, como en golden_split.call_rates.
        {"caseId": "d", "verdict": "uncertain", "external": "compliant", "externalFails": [], "error": "x"},
    ]
    out = agreement.compute(results, {"a": "A", "b": "B", "c": "C"}, {(30, "A")}, criteria)
    call = out["byCall"]
    assert (call["n"], call["agree"], call["undecided"], call["reviewerFn"], call["promptFp"]) == (3, 0, 1, 1, 1)
    item = out["byCallCriterion"]
    assert item["n"] == 6 and (item["agree"], item["undecided"], item["reviewerFn"], item["promptFp"]) == (3, 1, 1, 1)


def test_blue_needs_every_pattern_to_blame_the_auditor() -> None:
    def p(cid: int, cause: str, calls: list[str], observation: bool = False) -> DiscrepancyPattern:
        return DiscrepancyPattern(
            criterion_id=cid, is_observation=observation, data={"cause": cause}, cases=[{"callId": c} for c in calls]
        )

    patterns = [p(30, "auditor", ["A", "B"]), p(30, "rule_text", ["B"]), p(12, "auditor", ["C"], observation=True)]
    assert agreement.blue_cases(patterns) == {(30, "A")}


def test_out_of_credits_stops_the_loop_and_retry_only_reruns_the_errors(
    loop_db: sessionmaker[Session],
    admin: User,  # noqa: F811
) -> None:
    with loop_db() as session, session.begin():
        base = prompt_registry.ensure_bootstrap(session).version
        prompt_loop.start(session, session.get(User, admin.id), base, rounds=1)
    prompt_loop.advance(loop_db)

    def broke(model: str, system: str, user: str) -> tuple[str, float, int]:
        raise RuntimeError("Error code: 402 - prepayment credits are depleted")

    prompt_evaluation.process_pending(loop_db, caller=broke)
    assert prompt_loop.advance(loop_db) == "failed"
    with loop_db() as session, session.begin():
        loop = session.scalar(select(PromptLoop))
        train = session.get(PromptEvaluation, loop.rounds[0]["trainEvalId"])
        assert train.status == "failed" and "402" in train.error
        assert "trainEvalId" in prompt_loop.retry(session, loop)
        assert train.status == "queued" and train.results == [] and loop.status == "running"

    prompt_evaluation.process_pending(loop_db, caller=layer2)
    assert prompt_loop.advance(loop_db) == "vuelta 1: esperando el análisis de entrenamiento"
    with loop_db() as session:
        train = session.scalar(select(PromptEvaluation).where(PromptEvaluation.purpose == "train"))
        assert train.status == "done" and not prompt_evaluation.errored(train) and train.cost_usd > 0
