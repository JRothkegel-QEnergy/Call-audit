"use client";

import { ExportButton } from "@/components/dialogs/export-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
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
        title="Motivos"
        description="Incumplimientos confirmados · últimos 30 días. Haz clic en un motivo para ver sus llamadas."
        actions={<ExportButton />}
      />
      <AsyncView state={state} what="los motivos">
        {({ stats, heat }) => {
          const max = Math.max(1, ...heat.rows.flatMap((r) => r.counts));
          return (
            <>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Motivo</th>
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
                        Motivo {s.criterionId} · {rubric?.criteria[s.criterionId]?.name}
                      </td>
                      <td>{blockName(s.criterionId)}</td>
                      <td className="num">{s.count}</td>
                      <td className="num">{pct(s.pct)}</td>
                      <td className="num">{pts(s.deltaPts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2 className="mb-2 mt-5 text-base font-semibold">Motivo × ejecutivo</h2>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Motivo</th>
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
                      <td>Motivo {r.criterionId}</td>
                      {r.counts.map((v, i) => (
                        <td
                          key={heat.agents[i].id}
                          className="text-center font-semibold tabular"
                          style={{ background: `rgb(15 118 110 / ${(v / max) * 0.85})`, color: v / max > 0.55 ? "#fff" : "inherit" }}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
