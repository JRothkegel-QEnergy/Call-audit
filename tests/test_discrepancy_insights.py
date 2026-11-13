"""Cifras del Resumen de Discrepancias (docs/ux/admin-prompt-metrics/10-resumen-mas-informacion.md)."""

from collections import Counter

from call_audit.discrepancy_insights import concentration, items, mcnemar


def test_mcnemar_exacta() -> None:
    assert mcnemar(0, 0) == 1.0
    assert mcnemar(9, 9) == 1.0
    assert mcnemar(0, 10) < 0.01


def test_concentration_top_and_thresholds() -> None:
    c = concentration(Counter({18: 42, 15: 15, 6: 9, 3: 2, 30: 1, 2: 1}))
    assert c["total"] == 70 and c["criteria"] == 6
    assert c["to50"] == 1 and c["to80"] == 2
    assert [t["criterionId"] for t in c["top"]] == [18, 15, 6, 3, 30]


def test_items_cuadra_con_el_mosaico() -> None:
    """Fuente única: los desacuerdos por motivo son los fn/fp de las filas del mosaico; la duda queda fuera."""
    rows = [
        {
            "callId": "a",
            "items": [
                {"criterionId": 2, "kind": "fp", "blue": False},
                {"criterionId": 5, "kind": "undecided", "blue": False},
            ],
        },
        {
            "callId": "b",
            "items": [
                {"criterionId": 18, "kind": "fn", "blue": True},
                {"criterionId": 3, "kind": "agree", "blue": False},
            ],
        },
    ]
    found = items(rows)
    assert set(found) == {(2, "a"), (18, "b")}
    red_yellow = [k for k, v in found.items() if not v["blue"]]
    blue = [k for k, v in found.items() if v["blue"]]
    assert len(red_yellow) + len(blue) == len(found) == 2
