"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import { ExportButton } from "@/components/dialogs/export-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, UnavailableStats } from "@/components/ui/states";
import { api, isRealMode } from "@/lib/api";
import { pct, pts } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

export default function CriteriaPage() {
  const rubric = useRubric();
  const state = useAsync(async () => {
    const [stats, heat] = await Promise.all([api.listCriterionStats(), api.getCriterionHeatmap()]);
    return { stats, heat };
  }, []);
  const blockName = (id: number) => rubric?.blocks.find((b) => b.criterionIds.includes(id))?.name ?? "";
  return (
    <>
      <PageHeader
        title="Criterios"
        description="Incumplimientos confirmados · últimos 30 días. Haz clic en un criterio para ver sus llamadas."
        actions={<ExportButton />}
      />
      <AsyncView state={state} what="los criterios">
        {({ stats, heat }) => {
          const max = Math.max(1, ...heat.rows.flatMap((r) => r.counts));
          return (
            <>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Criterio</th>
                    <th>Bloque</th>
                    <th>Incumplimientos</th>
                    <th>% de llamadas</th>
                    <th>vs. periodo anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.criterionId}>
                      <td className="whitespace-normal">
                        Criterio {s.criterionId} · {rubric?.criteria[s.criterionId]?.name}
                        <RenunciationReasonsButton criterionId={s.criterionId} />
                      </td>
                      <td>{blockName(s.criterionId)}</td>
                      <td className="num">{s.count}</td>
                      <td className="num">{pct(s.pct)}</td>
                      <td className="num">{pts(s.deltaPts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2 className="mb-2 mt-5 text-base font-semibold">Criterio × ejecutivo</h2>
              {isRealMode ? (
                <UnavailableStats />
              ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Criterio</th>
                    {heat.agents.map((a) => (
                      <th key={a.id} className="text-center">
                        {a.name.split(" ")[0]} {a.name.split(" ")[1]?.[0]}.
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heat.rows.map((r) => (
                    <tr key={r.criterionId}>
                      <td>
                        Criterio {r.criterionId}
                        <RenunciationReasonsButton criterionId={r.criterionId} />
                      </td>
                      {r.counts.map((v, i) => (
                        <td
                          key={heat.agents[i].id}
                          className="text-center font-semibold tabular"
                          style={heatCellStyle(max ? v / max : 0)}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </>
          );
        }}
      </AsyncView>
    </>
  );
}

/**
 * Celda del heatmap: mezcla blanco → azul marino Qubyt (--blue-900, #133b64) y elige el color del texto
 * por contraste WCAG (el que dé mayor razón entre tinta #1f2a37 y blanco), en vez de un umbral fijo.
 * Contraste verificado en todo el rango: mínimo 4.6:1 (WCAG 1.4.3).
 */
const HEAT_FROM = [255, 255, 255];
const HEAT_TO = [0x13, 0x3b, 0x64];
const INK = [0x1f, 0x2a, 0x37];

function luminance([r, g, b]: number[]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function heatCellStyle(ratio: number): React.CSSProperties {
  // Ningún tono intermedio logra 4.5:1 con tinta ni con blanco (el mejor es ~3.8:1), así que la rampa
  // salta esa banda: mitad baja 0–0.5 (texto tinta, ≥ 4.6:1), mitad alta 0.7–0.95 (texto blanco, ≥ 4.6:1).
  const r = Math.min(Math.max(ratio, 0), 1);
  const t = r <= 0.5 ? r : 0.7 + ((r - 0.5) / 0.5) * 0.25;
  const bg = HEAT_FROM.map((c, i) => Math.round(c + (HEAT_TO[i] - c) * t));
  const fg = contrast(bg, HEAT_FROM) >= contrast(bg, INK) ? "var(--white)" : "var(--ink-900)";
  return { background: `rgb(${bg.join(" ")})`, color: fg };
}
