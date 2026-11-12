"""División fija del golden set y métricas por motivo (call_audit.golden_split), con datos sintéticos."""

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import discrepancies, golden_split, prompt_evaluation
from call_audit.persistence.models import Case


def synthetic_calls(n: int = 200) -> list[dict]:
    calls = []
    for i in range(n):
        fails = [18] if i % 3 == 0 else []
        if i % 40 == 0:
            fails.append(7)  # motivo raro: 5 llamadas
        calls.append(
            {
                "call_id": f"C{i:04d}",
                "verdict": "non_compliant" if fails else "compliant",
                "fails": fails,
                "evaluator": f"Evaluadora {i % 4}",
            }
        )
    return calls


def test_assign_is_deterministic_and_keeps_proportions() -> None:
    calls = synthetic_calls()
    first = golden_split.assign(calls)
    assert first == golden_split.assign(list(reversed(calls)))
    assert Counter(first.values()) == {"train": 120, "val": 40, "test": 40}


def test_assign_spreads_rare_criteria_and_verdicts() -> None:
    calls = synthetic_calls()
    splits = golden_split.assign(calls)
    rare = Counter(splits[c["call_id"]] for c in calls if 7 in c["fails"])
    assert rare["val"] >= 1 and rare["test"] >= 1
    rejected = Counter(splits[c["call_id"]] for c in calls if c["verdict"] == "non_compliant")
    assert all(rejected[s] > 0 for s in golden_split.SPLITS)
    for s in golden_split.SPLITS:
        assert len({c["evaluator"] for c in calls if splits[c["call_id"]] == s}) == 4


def test_assign_keeps_existing_and_only_places_new_calls() -> None:
    calls = synthetic_calls()
    existing = {"C0000": "test", "C0001": "train", "C0002": "nonsense"}
    splits = golden_split.assign(calls, existing)
    assert splits["C0000"] == "test" and splits["C0001"] == "train"
    assert splits["C0002"] in golden_split.SPLITS
    assert len(splits) == len(calls)


def test_criterion_scores_and_summary() -> None:
    rows = [
        {"verdict": "non_compliant", "external": "non_compliant", "aiFails": [3], "refFails": [3]},  # tp
        {"verdict": "non_compliant", "external": "compliant", "aiFails": [3], "refFails": []},  # fp
        {"verdict": "compliant", "external": "non_compliant", "aiFails": [], "refFails": [3], "aiUncertain": [3]},
        {"verdict": "compliant", "external": "compliant", "aiFails": [], "refFails": []},  # tn
    ]
    by = {x["criterionId"]: x for x in golden_split.criterion_scores(rows, [3, 9])}
    assert (by[3]["tp"], by[3]["fp"], by[3]["fn"], by[3]["tn"]) == (1, 1, 1, 1)
    assert by[3]["precision"] == 0.5 and by[3]["recall"] == 0.5 and by[3]["f1"] == 0.5
    assert by[3]["aiUncertain"] == 1
    assert by[9]["precision"] is None and by[9]["f1"] is None

    s = golden_split.summary(rows, [3, 9], min_support=2)
    assert s["n"] == 4 and s["callMatchRate"] == 0.5
    assert s["macroCriteria"] == [3] and s["macroF1"] == 0.5 and s["microF1"] == 0.5


def test_call_rates_against_goal() -> None:
    rows = [
        {"verdict": "non_compliant", "external": "compliant"},  # FP
        {"verdict": "compliant", "external": "compliant"},
        {"verdict": "uncertain", "external": "compliant"},  # dudosa: ni FP ni FN
        {"verdict": "compliant", "external": "non_compliant"},  # FN
        {"verdict": "non_compliant", "external": "non_compliant"},
    ]
    r = golden_split.call_rates(rows)
    assert r["callFpRate"] == 0.333 and r["callFnRate"] == 0.5
    assert r["callUncertainRate"] == 0.2 and r["callMatchRate"] == 0.4
    assert (r["fpGoal"], r["fnGoal"]) == (0.05, 0.2)
    assert (r["nCalls"], r["nApproved"], r["nRejected"]) == (5, 3, 2)
    assert (r["fpCount"], r["fnCount"], r["uncertainCount"]) == (1, 1, 1)


def test_without_criterion_estimates_approval() -> None:
    rows = [
        {"verdict": "non_compliant", "aiFails": [25], "aiUncertain": []},
        {"verdict": "non_compliant", "aiFails": [25], "aiUncertain": [3]},
        {"verdict": "non_compliant", "aiFails": [25, 18], "aiUncertain": []},
    ]
    out = golden_split.without_criterion(rows, 25)
    assert [r["verdict"] for r in out] == ["compliant", "uncertain", "non_compliant"]
    assert out[2]["aiFails"] == [18]


def test_layer2_criteria_excludes_hold_criterion() -> None:
    criteria = golden_split.layer2_criteria()
    assert 1 not in criteria and 3 in criteria


def assign_cases(session: Session, splits: dict[str, str]) -> None:
    for case in session.scalars(select(Case)):
        case.external_item_fails = case.external_item_fails or []
        if case.call_id in splits:
            case.call_metadata = {**case.call_metadata, golden_split.KEY: splits[case.call_id]}


def test_without_assignment_everything_behaves_as_before(imported: sessionmaker[Session]) -> None:
    with imported() as session:
        assert golden_split.default_split(session, "val") is None
        assert prompt_evaluation.eval_split(session) is None
        assert len(prompt_evaluation.calibration_cases(session)) == 3


def test_discrepancies_and_evaluation_respect_the_split(imported: sessionmaker[Session]) -> None:
    with imported() as session, session.begin():
        assign_cases(session, {"1001": "train", "1002": "val", "1003": "test"})
    with imported() as session:
        assert prompt_evaluation.eval_split(session) == "val"
        cases = prompt_evaluation.calibration_cases(session, prompt_evaluation.eval_split(session))
        assert [c.call_id for c, _ in cases] == ["1002"]

        _, _, summary = discrepancies.build(session, {}, "train")
        assert summary["n_calls"] == 1

        metrics = prompt_evaluation.current_metrics(session)
        assert metrics["splits"] == {"val": 1}
        assert metrics["criterionScores"]["n"] == 1
        assert {x["criterionId"] for x in metrics["criterionScores"]["byCriterion"]} == set(
            golden_split.layer2_criteria()
        )
