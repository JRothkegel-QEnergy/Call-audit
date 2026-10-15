"""Busca la ficha del catálogo que corresponde al seguro de la metadata de una llamada.

La metadata trae el NOMBRE DE PRODUCTO (ej. "SEGURO ONCOLOGICO Y MUERTE ACCIDENTAL"), que no siempre es igual al
"Nombre en sistema" del Excel de apoyo. Orden de búsqueda:
1. Igualdad exacta (sin tildes ni mayúsculas) con un nombre en sistema o con el nombre del producto.
2. Similitud de palabras contra el nombre del producto, los nombres en sistema y la hoja original del Excel,
   solo entre productos de la MISMA compañía. El canal (MUS / Salesforce) desempata.
Si la mejor similitud queda bajo MIN_SCORE, no hay match: la llamada va sin ficha.

Uso para revisar el cruce:
    python scripts/prompt_bench/catalog_match.py "<ruta>/metadata.xlsx"
"""

import math
import re
import sys
import unicodedata

MIN_SCORE = 0.5
STOPWORDS = {"SEGURO", "SEGUROS", "DE", "DEL", "Y", "CON", "EL", "LA", "LOS", "LAS", "POR", "EN", "A", "SEG"}
# Abreviaturas que usan los sistemas de BancoEstado.
EXPANSIONS = {
    "TLMK": "TELEMARKETING",
    "AP": "ACCIDENTES PERSONALES",
    "MP": "MEDIO PAGO",
    "ACC": "ACCIDENTAL",
    "ACCIDENTE": "ACCIDENTES",
    "PERSONAL": "PERSONALES",
}
INSURERS = {"METLIFE": "METLIFE", "HDI": "HDI", "CARDIF": "CARDIF", "BNP": "CARDIF", "SURA": "SURA"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return " ".join(text.upper().split())


def tokens(text: str) -> set[str]:
    words = re.findall(r"[A-Z0-9/]+", normalize(text))
    expanded = " ".join(EXPANSIONS.get(w, w) for w in words).split()
    # Raíz de 6 letras: ONCOLOGICO = ONCOLOGICA, ACCIDENTES = ACCIDENTAL.
    return {w[:6] for w in expanded if w not in STOPWORDS}


def insurer_key(text: str) -> str | None:
    norm = normalize(text)
    return next((v for k, v in INSURERS.items() if k in norm), None)


def product_texts(p: dict) -> list[str]:
    return [t for t in [p["name"], *p["system_names"], *str(p.get("source_sheet") or "").split(" / ")] if t]


def idf_weights(catalog: dict) -> dict[str, float]:
    """Palabras raras pesan más: "PESCADORES" distingue más que "MEDIO PAGO", que aparece en muchos productos."""
    docs = [set().union(*(tokens(t) for t in product_texts(p))) for p in catalog["products"] if p.get("id")]
    df: dict[str, int] = {}
    for d in docs:
        for w in d:
            df[w] = df.get(w, 0) + 1
    return {w: math.log(1 + len(docs) / n) for w, n in df.items()}


def score(a: set[str], b: set[str], weights: dict[str, float]) -> float:
    w = lambda s: sum(weights.get(t, math.log(2 + len(weights))) for t in s)  # noqa: E731
    return 2 * w(a & b) / (w(a) + w(b)) if a and b else 0.0


def digits(text) -> str:
    return re.sub(r"\D", "", str(text or ""))


def premium_matches(p: dict, premium) -> bool:
    try:
        target = float(premium)
    except (TypeError, ValueError):
        return False
    for r in p.get("premiums", []):
        try:
            if abs(float(str(r.get("premium_uf")).replace(",", ".")) - target) < 1e-4:
                return True
        except ValueError:
            continue
    return False


def match(
    name: str, insurer: str | None, channel: str | None, catalog: dict, policy=None, premium=None, plan=None
) -> tuple[dict | None, float, str]:
    """Devuelve (producto, puntaje, cómo se encontró)."""
    target = normalize(name)
    company = insurer_key(insurer) if insurer else None
    same_company = lambda p: not company or not p.get("insurer") or insurer_key(p["insurer"]) == company  # noqa: E731

    # 1. Nombre en sistema exacto (es el identificador oficial).
    for p in catalog["products"]:
        if same_company(p) and target in {normalize(n) for n in p["system_names"]}:
            return p, 1.0, "nombre en sistema"

    # 2. N° de póliza: la columna "Pólizas" del Excel de apoyo lista las pólizas de cada producto.
    pol = digits(policy)
    if len(pol) >= 3:
        by_policy = [
            p for p in catalog["products"]
            if p.get("id") and same_company(p) and pol in {digits(x) for x in re.split(r"[,/]|\s(?=MUS|Salesforce)", str(p.get("policies") or ""))}
        ]
        if len(by_policy) > 1:  # una póliza puede cubrir varios planes (ej. Pescador 1 y 2): desempata la prima
            by_premium = [p for p in by_policy if premium_matches(p, premium)]
            by_policy = by_premium or by_policy
        if len(by_policy) == 1:
            return by_policy[0], 1.0, "n° de póliza" + (" + prima" if premium_matches(by_policy[0], premium) else "")

    # 3. Nombre de producto exacto, y 4. similitud de palabras (nombre y también nombre + plan de la metadata).
    candidates = [p for p in catalog["products"] if p.get("id") and same_company(p)]
    for p in candidates:
        if target == normalize(p["name"]):
            return p, 1.0, "nombre de producto"

    weights = idf_weights(catalog)
    plan_text = re.sub(r"\bPLAN\s*\d+\b", "", normalize(plan)) if plan else ""
    wanted_sets = [tokens(name)] + ([tokens(f"{name} {plan_text}")] if plan_text.strip() else [])
    channel_norm = normalize(channel).replace("SALEFORCE", "SALESFORCE") if channel else ""
    best, best_score = None, 0.0
    for p in candidates:
        s = max(score(w, tokens(t), weights) for w in wanted_sets for t in product_texts(p))
        if channel_norm and any(normalize(c) == channel_norm for c in p.get("channels", [])):
            s += 0.05
        if premium_matches(p, premium):
            s += 0.1
        if s > best_score:
            best, best_score = p, s
    if best_score < MIN_SCORE:
        return None, best_score, "sin match"
    return best, round(min(best_score, 1.0), 2), "similitud de nombre"


def main() -> None:
    import json
    from pathlib import Path

    import openpyxl

    catalog = json.loads((Path(__file__).resolve().parents[2] / "data" / "catalog" / "products.json").read_text(encoding="utf-8"))
    rows = openpyxl.load_workbook(sys.argv[1], read_only=True).active.iter_rows(values_only=True)
    header = next(rows)
    company_col = next(i for i, h in enumerate(header) if h and normalize(h).startswith("COMPA"))
    seen = {}
    for r in rows:
        d = dict(zip(header, r))
        p, s, how = match_row(d, catalog, insurer=r[company_col])
        found = f"{p['id']} {p['name']} ({p['insurer']})" if p else "—"
        key = (str(d["NOMBRE_DEL_SEGURO"]).strip(), str(d.get("PLAN")).strip(), str(d.get("NUM_POLIZA")), found, s, how)
        seen[key] = seen.get(key, 0) + 1
    for (name, plan, policy, found, s, how), n in sorted(seen.items()):
        print(f"{n:>3} | {name} | plan: {plan} | póliza {policy} -> {found} | {s} {how}")


def match_row(row: dict, catalog: dict, insurer=None) -> tuple[dict | None, float, str]:
    """Match con una fila del Excel de metadata (NOMBRE_DEL_SEGURO, COMPAÑIA, TIPO_SEGURO, NUM_POLIZA, PRIMA_SEGURO, PLAN)."""
    if insurer is None:
        insurer = next((v for k, v in row.items() if k and normalize(k).startswith("COMPA")), None)
    return match(
        str(row["NOMBRE_DEL_SEGURO"]).strip(), insurer, row.get("TIPO_SEGURO"), catalog,
        policy=row.get("NUM_POLIZA"), premium=row.get("PRIMA_SEGURO"), plan=row.get("PLAN"),
    )


if __name__ == "__main__":
    main()
