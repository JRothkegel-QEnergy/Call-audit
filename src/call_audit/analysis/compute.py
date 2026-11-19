"""Cálculos de «Calidad del servicio» sobre las llamadas de una foto. Sin IA ni base de datos: funciones puras.

Definiciones (docs/ux/vistas-supervisor/02-ideacion.md §4 y 08-alta-fidelidad.md §4.1):
- Según la IA: % de las llamadas con corrida donde la IA marcó el motivo No cumple. Dudoso no cuenta como No cumple.
- Según la planilla: % de las llamadas evaluadas por la planilla donde el evaluador lo marcó No cumple.
- Diferencia = % planilla − % IA, en puntos.
- No coinciden: % de las llamadas evaluadas donde una fuente marca el motivo y la otra no.
- Estado del motivo: `data_explained` si está en la lista de motivos explicados por los datos; `divergent` si la
  mayoría de los evaluadores con suficientes llamadas discrepa de la IA en U puntos o más (sin evaluadores con
  suficientes llamadas, se usa el No coinciden de todos); `consistent` en otro caso; `na` sin planilla.
- Desvío de un ejecutivo: su % según la IA menos el del equipo con los mismos filtros (D-27: solo IA).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

ALL = "all"
CRITERIA = tuple(range(1, 34))
EMPTY: frozenset[int] = frozenset()


@dataclass(frozen=True)
class Config:
    u: float = 15.0  # puntos de desacuerdo para «Se marca distinto» (H-14, D-21)
    equal: float = 2.0  # ± puntos que cuentan como «Igual que el equipo»
    low: int = 10  # bajo esto, «pocas llamadas»
    min_agents: int = 5  # ejecutivos con `low` llamadas o más para abrir Ejecutivos (D-27)
    period_days: int = 90
    page_size: int = 50
    top_criteria: int = 10  # motivos que muestra la ficha del ejecutivo de entrada (D-23)
    data_explained: dict[int, str] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "u": self.u,
            "equal": self.equal,
            "low": self.low,
            "minAgents": self.min_agents,
            "periodDays": self.period_days,
            "pageSize": self.page_size,
            "topCriteria": self.top_criteria,
            "dataExplained": {str(k): v for k, v in self.data_explained.items()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Config:
        return cls(
            u=data.get("u", 15.0),
            equal=data.get("equal", 2.0),
            low=data.get("low", 10),
            min_agents=data.get("minAgents", 5),
            period_days=data.get("periodDays", 90),
            page_size=data.get("pageSize", 50),
            top_criteria=data.get("topCriteria", 10),
            data_explained={int(k): v for k, v in (data.get("dataExplained") or {}).items()},
        )


DATA_EXPLAINED = {
    25: (
        "Parte de la diferencia viene de los datos de la gestión: el sistema registra una fila por grabación aunque en "
        "la llamada se gestionen varios seguros. No refleja solo el trabajo del ejecutivo."
    )
}


@dataclass(frozen=True)
class Call:
    case_id: str
    call_id: str
    call_date: str
    agent_id: str
    agent_name: str
    evaluator: str | None
    insurance_type: str
    flow: str
    ai_fails: frozenset[int]
    sheet_fails: frozenset[int] | None
    ai_evidence_ms: dict[int, int]
    ai_verdict: str
    sheet_verdict: str | None
    # De dónde sale la referencia humana («Según el auditor», D-31): "auditor" si hay revisión en la app; si no,
    # "sheet" (la planilla de la metadata). None: ninguna de las dos.
    reference: str | None = None


def pct(part: int, whole: int) -> float | None:
    return round(100 * part / whole, 1) if whole else None


def filtered(calls: list[Call], insurance_type: str = ALL, flow: str = ALL) -> list[Call]:
    return [
        c
        for c in calls
        if (insurance_type in (ALL, "") or c.insurance_type == insurance_type) and (flow in (ALL, "") or c.flow == flow)
    ]


def mismatch(call: Call, cid: int) -> bool:
    assert call.sheet_fails is not None
    return (cid in call.ai_fails) != (cid in call.sheet_fails)


def criterion_numbers(calls: list[Call], cid: int) -> dict[str, Any]:
    evaluated = [c for c in calls if c.sheet_fails is not None]
    ai = pct(sum(cid in c.ai_fails for c in calls), len(calls)) or 0.0
    sheet = pct(sum(cid in c.sheet_fails for c in evaluated if c.sheet_fails is not None), len(evaluated))
    mismatched = sum(mismatch(c, cid) for c in evaluated)
    return {
        "aiPct": ai,
        "sheetPct": sheet,
        "gapPts": round(sheet - ai, 1) if sheet is not None else None,
        "mismatchPct": pct(mismatched, len(evaluated)),
        "mismatchCalls": mismatched,
        "base": {"withRun": len(calls), "evaluated": len(evaluated)},
    }


def criterion_status(calls: list[Call], cid: int, numbers: dict[str, Any], config: Config) -> str:
    if cid in config.data_explained:
        return "data_explained"
    if not numbers["base"]["evaluated"]:
        return "na"
    by_evaluator: dict[str, list[Call]] = defaultdict(list)
    for c in calls:
        if c.sheet_fails is not None and c.evaluator:
            by_evaluator[c.evaluator].append(c)
    enough = [cs for cs in by_evaluator.values() if len(cs) >= config.low]
    if enough:
        high = sum(100 * sum(mismatch(c, cid) for c in cs) / len(cs) >= config.u for cs in enough)
        return "divergent" if high > len(enough) / 2 else "consistent"
    return "divergent" if (numbers["mismatchPct"] or 0) >= config.u else "consistent"


def criteria_rows(calls: list[Call], blocks: dict[int, str], config: Config) -> list[dict[str, Any]]:
    rows = []
    for cid in CRITERIA:
        numbers = criterion_numbers(calls, cid)
        rows.append(
            {
                "criterionId": cid,
                "blockId": blocks.get(cid, ""),
                **numbers,
                "status": criterion_status(calls, cid, numbers, config),
                "dataExplainedNote": config.data_explained.get(cid),
            }
        )
    # Orden por defecto: No coinciden, de mayor a menor (C-01).
    rows.sort(key=lambda r: (-(r["mismatchPct"] or -1), r["criterionId"]))
    return rows


def fails_on(call: Call, cid: int | None) -> bool:
    """Sin motivo: la IA marcó al menos un motivo No cumple en la llamada."""
    return bool(call.ai_fails) if cid is None else cid in call.ai_fails


def sheet_fails_on(call: Call, cid: int | None) -> bool:
    assert call.sheet_fails is not None
    return bool(call.sheet_fails) if cid is None else cid in call.sheet_fails


def agent_rows(calls: list[Call], cid: int | None, config: Config) -> list[dict[str, Any]]:
    team = pct(sum(fails_on(c, cid) for c in calls), len(calls)) or 0.0
    by_agent: dict[str, list[Call]] = defaultdict(list)
    for c in calls:
        by_agent[c.agent_id].append(c)
    rows = []
    for agent_id, cs in by_agent.items():
        evaluated = [c for c in cs if c.sheet_fails is not None]
        ai = pct(sum(fails_on(c, cid) for c in cs), len(cs)) or 0.0
        rows.append(
            {
                "agentId": agent_id,
                "name": cs[0].agent_name,
                "calls": len(cs),
                "evaluated": len(evaluated),
                "aiPct": ai,
                "sheetPct": pct(sum(sheet_fails_on(c, cid) for c in evaluated), len(evaluated)),
                "deviationPts": round(ai - team, 1),
                "lowSample": len(cs) < config.low,
            }
        )
    # Por desvío según la IA; «pocas llamadas» al final (sin posiciones: no es un ranking).
    rows.sort(key=lambda r: (r["lowSample"], -r["deviationPts"], r["name"]))
    return rows


def agents_gate(calls: list[Call], config: Config) -> dict[str, Any]:
    counts: dict[str, int] = defaultdict(int)
    for c in calls:
        counts[c.agent_id] += 1
    enough = sum(n >= config.low for n in counts.values())
    return {"open": enough >= config.min_agents, "agentsWithEnough": enough, "totalAgents": len(counts)}


def agent_detail(
    calls: list[Call], agent_id: str, config: Config, show_all: bool, periods: list[dict[str, str]] | None = None
) -> dict[str, Any] | None:
    mine = [c for c in calls if c.agent_id == agent_id]
    if not mine:
        return None
    row = next(r for r in agent_rows(calls, None, config) if r["agentId"] == agent_id)
    evaluated = [c for c in mine if c.sheet_fails is not None]
    criteria = []
    for cid in CRITERIA:
        team = pct(sum(cid in c.ai_fails for c in calls), len(calls)) or 0.0
        ai = pct(sum(cid in c.ai_fails for c in mine), len(mine)) or 0.0
        criteria.append(
            {
                "criterionId": cid,
                "aiPct": ai,
                "sheetPct": pct(sum(sheet_fails_on(c, cid) for c in evaluated), len(evaluated)),
                "deviationPts": round(ai - team, 1),
            }
        )
    # Mayor desvío primero; los explicados por los datos (motivo 25) al final (D-10).
    criteria.sort(key=lambda r: (r["criterionId"] in config.data_explained, -r["deviationPts"], r["criterionId"]))
    return {
        "agent": row,
        "criteria": criteria if show_all else criteria[: config.top_criteria],
        "showingAll": show_all or len(criteria) <= config.top_criteria,
        "trend": agent_trend(calls, agent_id, periods or [], config),
    }


def criterion_detail(calls: list[Call], cid: int, blocks: dict[int, str], config: Config) -> dict[str, Any]:
    numbers = criterion_numbers(calls, cid)
    by_type: dict[str, list[Call]] = defaultdict(list)
    for c in calls:
        by_type[c.insurance_type].append(c)
    types = []
    for name, cs in sorted(by_type.items()):
        n = criterion_numbers(cs, cid)
        types.append(
            {
                "insuranceType": name,
                "calls": len(cs),
                "aiPct": n["aiPct"],
                "sheetPct": n["sheetPct"],
                "mismatchPct": n["mismatchPct"],
                "lowSample": len(cs) < config.low,
            }
        )
    gate = agents_gate(calls, config)
    deviating = []
    if gate["open"]:
        rows = [
            r for r in agent_rows(calls, cid, config) if not r["lowSample"] and abs(r["deviationPts"]) > config.equal
        ]
        rows.sort(key=lambda r: -abs(r["deviationPts"]))
        deviating = [{"agentId": r["agentId"], "name": r["name"], "deviationPts": r["deviationPts"]} for r in rows[:10]]
    return {
        "criterionId": cid,
        "blockId": blocks.get(cid, ""),
        **numbers,
        "status": criterion_status(calls, cid, numbers, config),
        "dataExplainedNote": config.data_explained.get(cid),
        "byInsuranceType": types,
        "deviatingAgents": deviating,
        "agentsGate": gate,
    }


def kappa(pairs: list[tuple[bool, bool]]) -> float | None:
    """Kappa de Cohen entre la IA y la planilla para un motivo (solo para el detalle interno)."""
    n = len(pairs)
    if not n:
        return None
    po = sum(a == b for a, b in pairs) / n
    pa = sum(a for a, _ in pairs) / n
    pb = sum(b for _, b in pairs) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return None if pe >= 1 else round((po - pe) / (1 - pe), 2)


def evaluator_rows(calls: list[Call], config: Config) -> list[dict[str, Any]]:
    evaluated = [c for c in calls if c.sheet_fails is not None and c.evaluator]
    by_eval: dict[str, list[Call]] = defaultdict(list)
    for c in evaluated:
        by_eval[c.evaluator or ""].append(c)

    def per_call(cs: list[Call]) -> tuple[float, float]:
        disagree = sum(sum(mismatch(c, cid) for cid in CRITERIA) for c in cs) / len(cs)
        sheet_only = sum(len((c.sheet_fails or EMPTY) - c.ai_fails) for c in cs)
        ai_only = sum(len(c.ai_fails - (c.sheet_fails or EMPTY)) for c in cs)
        severity = (sheet_only - ai_only) / len(cs)
        return disagree, severity

    team = per_call(evaluated)[0] if evaluated else 0.0
    rows = []
    for name, cs in by_eval.items():
        disagree, severity = per_call(cs)
        rows.append(
            {
                "name": name,
                "evaluated": len(cs),
                "disagreementPerCall": round(disagree, 2),
                "severityPerCall": round(severity, 2),
                "vsTeam": round(disagree - team, 2),
                "lowSample": len(cs) < config.low,
            }
        )
    rows.sort(key=lambda r: (r["lowSample"], -r["disagreementPerCall"], r["name"]))
    return rows


def reviewed(calls: list[Call]) -> list[Call]:
    return [c for c in calls if c.sheet_fails is not None and c.evaluator]


def disagreement_per_call(cs: list[Call]) -> float:
    return sum(sum(mismatch(c, cid) for cid in CRITERIA) for c in cs) / len(cs) if cs else 0.0


def evaluator_cell(cs: list[Call], cid: int) -> dict[str, Any]:
    pairs = [(cid in c.ai_fails, cid in (c.sheet_fails or EMPTY)) for c in cs]
    sheet_only = sum(b and not a for a, b in pairs)
    ai_only = sum(a and not b for a, b in pairs)
    return {
        "criterionId": cid,
        "mismatchCalls": sheet_only + ai_only,
        "evaluated": len(cs),
        "disagreementPct": pct(sheet_only + ai_only, len(cs)) or 0.0,
        "severityPts": round(100 * (sheet_only - ai_only) / len(cs), 1) if cs else 0.0,
        "kappa": kappa(pairs),
    }


def team_disagreement_pct(team: list[Call], cid: int) -> float:
    return pct(sum(mismatch(c, cid) for c in team), len(team)) or 0.0


def evaluator_detail(
    calls: list[Call], name: str, config: Config | None = None, periods: list[dict[str, str]] | None = None
) -> dict[str, Any] | None:
    config = config or Config()
    team = reviewed(calls)
    cs = [c for c in team if c.evaluator == name]
    if not cs:
        return None
    criteria = [evaluator_cell(cs, cid) | {"teamDisagreementPct": team_disagreement_pct(team, cid)} for cid in CRITERIA]
    # Donde más se aparta del equipo primero (FA-2).
    criteria.sort(key=lambda r: (-(r["disagreementPct"] - r["teamDisagreementPct"]), r["criterionId"]))
    trend = []
    for p in periods or []:
        mine = in_period(cs, p)
        trend.append(
            {
                "periodId": p["id"],
                "evaluated": len(mine),
                "disagreementPerCall": round(disagreement_per_call(mine), 2),
                "teamDisagreementPerCall": round(disagreement_per_call(in_period(team, p)), 2),
                "lowSample": len(mine) < config.low,
            }
        )
    return {"name": name, "evaluated": len(cs), "criteria": criteria, "trend": trend}


def evaluator_matrix(calls: list[Call], blocks: dict[int, str], config: Config) -> dict[str, Any]:
    """Mapa auditor × motivo (A-2): % de las llamadas de cada auditor en que no coincide con la IA."""
    team = reviewed(calls)
    rows = []
    for r in evaluator_rows(calls, config):
        cs = [c for c in team if c.evaluator == r["name"]]
        cells = []
        for cid in CRITERIA:
            cell = evaluator_cell(cs, cid)
            cells.append(
                {k: cell[k] for k in ("criterionId", "mismatchCalls", "disagreementPct", "severityPts")}
                | {"lowSample": r["lowSample"]}
            )
        keep = ("name", "evaluated", "disagreementPerCall", "lowSample")
        rows.append({k: r[k] for k in keep} | {"cells": cells})
    enough = [r for r in rows if not r["lowSample"]]
    criteria = []
    for i, cid in enumerate(CRITERIA):
        # «Se marca distinto»: la mayoría de los auditores con suficientes llamadas en U o más (D-06/D-21).
        high = sum(r["cells"][i]["disagreementPct"] >= config.u for r in enough)
        criteria.append(
            {
                "criterionId": cid,
                "blockId": blocks.get(cid, ""),
                "markedDifferent": bool(enough) and high > len(enough) / 2 and cid not in config.data_explained,
                "teamDisagreementPct": team_disagreement_pct(team, cid),
            }
        )
    return {
        "criteria": criteria,
        "team": {"evaluated": len(team), "disagreementPerCall": round(disagreement_per_call(team), 2)},
        "rows": rows,
    }


def periods_of(period_to: str | None, period_days: int, size: int = 30, count: int = 3) -> list[dict[str, str]]:
    """Tramos de la evolución (D-36): 3 de 30 días hacia atrás desde el fin de la foto; nada si cubre < 60 días."""
    if period_days < 60 or not period_to:
        return []
    end = date.fromisoformat(period_to[:10])
    spans = []
    for i in range(count):
        to = end - timedelta(days=size * i)
        spans.append(((to - timedelta(days=size - 1)).isoformat(), to.isoformat()))
    spans.reverse()
    return [{"id": f"p{i + 1}", "from": a, "to": b} for i, (a, b) in enumerate(spans)]


def in_period(calls: list[Call], period: dict[str, str]) -> list[Call]:
    return [c for c in calls if period["from"] <= c.call_date[:10] <= period["to"]]


def agent_trend(
    calls: list[Call], agent_id: str, periods: list[dict[str, str]], config: Config
) -> list[dict[str, Any]]:
    out = []
    for p in periods:
        everyone = in_period(calls, p)
        mine = [c for c in everyone if c.agent_id == agent_id]
        evaluated = [c for c in mine if c.sheet_fails is not None]
        out.append(
            {
                "periodId": p["id"],
                "calls": len(mine),
                "evaluated": len(evaluated),
                "aiPct": pct(sum(bool(c.ai_fails) for c in mine), len(mine)) or 0.0,
                "sheetPct": pct(sum(bool(c.sheet_fails) for c in evaluated), len(evaluated)),
                "teamAiPct": pct(sum(bool(c.ai_fails) for c in everyone), len(everyone)) or 0.0,
                "lowSample": len(mine) < config.low,
            }
        )
    return out


def agents_team(calls: list[Call], cid: int | None, config: Config) -> dict[str, Any]:
    """Cifras del equipo para la pestaña Ejecutivos (E-1); respetan el motivo elegido."""
    evaluated = [c for c in calls if c.sheet_fails is not None]
    rows = [r for r in agent_rows(calls, cid, config) if not r["lowSample"]]
    return {
        "calls": len(calls),
        "evaluated": len(evaluated),
        "aiPct": pct(sum(fails_on(c, cid) for c in calls), len(calls)) or 0.0,
        "sheetPct": pct(sum(sheet_fails_on(c, cid) for c in evaluated), len(evaluated)),
        "withinRange": sum(abs(r["deviationPts"]) <= config.equal for r in rows),
        "agentsWithEnough": len(rows),
    }


def agent_cells(mine: list[Call], team_ai: dict[int, float]) -> list[dict[str, Any]]:
    evaluated = [c for c in mine if c.sheet_fails is not None]
    out = []
    for cid in CRITERIA:
        ai = pct(sum(cid in c.ai_fails for c in mine), len(mine)) or 0.0
        out.append(
            {
                "criterionId": cid,
                "aiPct": ai,
                "sheetPct": pct(sum(sheet_fails_on(c, cid) for c in evaluated), len(evaluated)),
                "evaluated": len(evaluated),
                "deviationPts": round(ai - team_ai[cid], 1),
            }
        )
    return out


def agent_matrix(calls: list[Call], blocks: dict[int, str], config: Config, page: int) -> dict[str, Any]:
    """Mapa ejecutivo × motivo (E-2): desvío frente al equipo según la IA, mismo orden y página que la tabla."""
    gate = agents_gate(calls, config)
    rows = agent_rows(calls, None, config)
    by_agent: dict[str, list[Call]] = defaultdict(list)
    for c in calls:
        by_agent[c.agent_id].append(c)
    team_ai = {cid: pct(sum(cid in c.ai_fails for c in calls), len(calls)) or 0.0 for cid in CRITERIA}
    cells = {r["agentId"]: agent_cells(by_agent[r["agentId"]], team_ai) for r in rows}
    enough = [r for r in rows if not r["lowSample"]]
    criteria = [
        {
            "criterionId": cid,
            "blockId": blocks.get(cid, ""),
            "teamAiPct": team_ai[cid],
            "agentsOutside": sum(abs(cells[r["agentId"]][i]["deviationPts"]) > config.equal for r in enough),
            "dataExplained": cid in config.data_explained,
        }
        for i, cid in enumerate(CRITERIA)
    ]
    start = (max(page, 1) - 1) * config.page_size
    shown = rows[start : start + config.page_size] if gate["open"] else []
    keep = ("agentId", "name", "calls", "lowSample")
    return {
        "gate": gate,
        "criteria": criteria,
        "rows": [{k: r[k] for k in keep} | {"cells": cells[r["agentId"]]} for r in shown],
        "total": len(rows),
        "page": max(page, 1),
        "pageSize": config.page_size,
    }


def calls_page(
    calls: list[Call],
    *,
    cid: int | None,
    source: str | None,
    agent_id: str | None,
    evaluator: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    rows = calls
    if agent_id:
        rows = [c for c in rows if c.agent_id == agent_id]
    if evaluator:
        rows = [c for c in rows if c.evaluator == evaluator]
    if cid is not None:
        if source == "sheet":
            rows = [c for c in rows if c.sheet_fails is not None and cid in c.sheet_fails]
        elif source == "mismatch":
            rows = [c for c in rows if c.sheet_fails is not None and mismatch(c, cid)]
        else:
            rows = [c for c in rows if cid in c.ai_fails]
    rows = sorted(rows, key=lambda c: (c.call_date, c.call_id), reverse=True)
    total = len(rows)
    start = (max(page, 1) - 1) * page_size
    return {
        "rows": [
            {
                "caseId": c.case_id,
                "callId": c.call_id,
                "callDate": c.call_date,
                "agentName": c.agent_name,
                "insuranceType": c.insurance_type,
                "aiVerdict": c.ai_verdict,
                "sheetVerdict": c.sheet_verdict,
                "reference": c.reference,
                "aiFails": cid is not None and cid in c.ai_fails,
                "sheetFails": None if c.sheet_fails is None or cid is None else cid in c.sheet_fails,
                "evidenceMs": c.ai_evidence_ms.get(cid) if cid is not None else None,
            }
            for c in rows[start : start + page_size]
        ],
        "total": total,
        "page": max(page, 1),
        "pageSize": page_size,
    }
