"""Carga la rúbrica versionada (rubrics/<protocolo>/v<semver>.yaml)."""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml


@dataclass(frozen=True)
class Criterion:
    id: int
    description: str
    block: str
    layers: tuple[str, ...]
    severity: str
    product_sheet_section: str | None


@dataclass(frozen=True)
class Block:
    id: str
    name: str
    criteria: tuple[int, ...]


@dataclass(frozen=True)
class Rubric:
    id: str
    version: str
    blocks: tuple[Block, ...]
    criteria: dict[int, Criterion]
    minor: frozenset[int]
    hold_limit_sec: int

    def is_critical(self, criterion_id: int) -> bool:
        # La gravedad sigue TBD con el cliente: ningún motivo es crítico hasta que la confirmen.
        return self.criteria[criterion_id].severity == "critical"


def parse_rubric(data: dict) -> Rubric:
    criteria = {}
    for c in data["criteria"]:
        cid = int(str(c["id"]).removeprefix("M"))
        criteria[cid] = Criterion(
            id=cid,
            description=c["description"],
            block=c["block"],
            layers=tuple(c["layers"]),
            severity=str(c["severity"]),
            product_sheet_section=c.get("product_sheet_section"),
        )
    blocks = tuple(Block(b["id"], b["name"], tuple(b["criteria"])) for b in data["blocks"])
    decision = data["decision"]
    return Rubric(
        id=data["id"],
        version=str(data["version"]),
        blocks=blocks,
        criteria=criteria,
        minor=frozenset(decision["minor_proposal"]),
        hold_limit_sec=int(decision["hold_limit_sec"]),
    )


@lru_cache
def load_rubric(path: Path) -> Rubric:
    return parse_rubric(yaml.safe_load(path.read_text(encoding="utf-8")))
