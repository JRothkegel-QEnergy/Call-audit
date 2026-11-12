import type { AdminStats } from "@/lib/api/admin-types";
import { int, shortDate } from "@/lib/format";

type Point = AdminStats["operation"]["daily"][number];

/** Con muchas barras no caben todas las fechas: se muestra una de cada `step`, siempre la primera y la última. */
function labelStep(bars: number): number {
  if (bars <= 7) return 1;
  return bars <= 14 ? 2 : 5;
}

function showsLabel(index: number, bars: number): boolean {
  const last = bars - 1;
  if (index === last) return true;
  const step = labelStep(bars);
  // Una fecha muy cerca de la última se pisaría con ella.
  return index % step === 0 && last - index >= step;
}

function labelPosition(index: number, bars: number): string {
  if (index === 0) return "left-0";
  if (index === bars - 1) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

function chartDescription(points: Point[], range: string): string {
  const withCalls = points.filter((p) => p.calls > 0).map((p) => `${shortDate(p.date)}: ${p.calls}`);
  const closing = withCalls.length < points.length ? ", los demás días, 0" : "";
  return `${range ? `${range}. ` : ""}${withCalls.join(", ")}${closing}`;
}

/** Llamadas procesadas por día o semana. Con más de 14 barras, solo la más alta lleva valor y hay tabla desplegable. */
export function ProcessedChart({
  points,
  bucket,
  range,
  filtered,
  emptyMessage,
}: {
  points: Point[];
  bucket: AdminStats["operation"]["dailyBucket"];
  range: string;
  filtered: boolean;
  emptyMessage: React.ReactNode;
}) {
  const unit = bucket === "week" ? "semana" : "día";
  const dense = points.length > 14;
  const max = Math.max(1, ...points.map((p) => p.calls));
  const tallest = points.findIndex((p) => p.calls === max);
  return (
    <div className="card">
      <b>Llamadas procesadas por {unit}</b>
      {points.length === 0 ? (
        <p className="help mb-0 mt-3">{emptyMessage}</p>
      ) : (
        <>
          <div className={`flex h-[140px] items-end border-b border-border pt-4 ${dense ? "gap-px" : "gap-2"}`} role="img" aria-label={chartDescription(points, range)}>
            {points.map((p, i) => (
              <div key={p.date} className="relative max-w-12 flex-1 rounded-t-[3px] bg-primary" style={{ height: `${(p.calls / max) * 85}%` }}>
                {(!dense || i === tallest) && (
                  <span className="absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground">{int(p.calls)}</span>
                )}
              </div>
            ))}
          </div>
          <div className={`help mt-1 flex h-4 ${dense ? "gap-px" : "gap-2"}`} aria-hidden="true">
            {points.map((p, i) => (
              <div key={p.date} className="relative max-w-12 flex-1">
                {showsLabel(i, points.length) && <span className={`absolute whitespace-nowrap ${labelPosition(i, points.length)}`}>{shortDate(p.date)}</span>}
              </div>
            ))}
          </div>
          <p className="help mb-0 mt-2">
            Cada llamada cuenta una vez, el día de su primera corrida sin error{filtered ? " con estos filtros" : ""}.
          </p>
          {dense && (
            <details className="mt-2">
              <summary className="help cursor-pointer">Ver datos por {unit}</summary>
              <table className="tbl flat mt-2">
                <thead>
                  <tr>
                    <th>{bucket === "week" ? "Semana" : "Día"}</th>
                    <th>Llamadas</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.date}>
                      <td className="tabular">{shortDate(p.date)}</td>
                      <td className="num">{int(p.calls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </div>
  );
}
