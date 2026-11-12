# Estado del proceso UX · Filtros de Estadísticas (admin)

- **Tipo de cambio:** ajuste acotado a una pantalla existente (`/admin/stats`). Revisión rápida con un solo gate.
- **Fase actual:** implementado y revisado contra `07-especificacion.md` §3. Sin commit todavía.
- **Temas legales y anonimización:** fuera de este cambio, por indicación de Johannes.

## Alcance del proceso

| Fase | Aplica | Motivo |
|---|---|---|
| 0 Brief | Comprimido | Definido en el pedido |
| 1 Investigación, 2 Ideación, 3 AI | No | Actor conocido; la pantalla no cambia de estructura |
| 4 Flujos, 5 Patrones, 6 UX writing | Comprimido | `07-especificacion.md` §2, §4, §5 y §7 |
| 7a Wireframe | No | Reubica controles existentes; §2 basta |
| 7b/7c Prototipo y test | No | Se valida con la tabla de §3 sobre la base local |
| 8 Alta fidelidad | No | Sin tokens ni componentes nuevos |

## Aprobaciones

| Paso | Estado | Fecha | Notas |
|---|---|---|---|
| Conectar los filtros (pedido) | Aprobado | 2026-11-09 | Johannes |
| Decisiones 1 a 5 y especificación | Aprobado | 2026-11-09 | Johannes: todas las recomendadas (opción A) |
| Implementación | Hecha | 2026-11-09 | |
| Revisión post-implementación | Hecha | 2026-11-09 | §3 calculada sobre la base local (8 filas); en navegador, una copia de esa base con 30 días, vacíos, URL y foco |

## Decisiones tomadas (se eligió la A en todas)

1. **Alcance de los filtros:** A) barra solo dentro de Operación y Costo, con hints en los KPI que no filtran. B) barra arriba, deshabilitada en Calidad. C) aplicarla también a Calidad.
2. **Periodo:** A) contado desde hoy, con Todo el historial por defecto. B) desde hoy, con 30 días por defecto. C) desde la última actividad.
3. **Gráfico con 30 días:** A) 30 barras, periodo completo. B) mantener 14 días. C) agrupar por semana.
4. **Llamadas procesadas con modelo o prompt:** A) primera corrida sin error dentro del filtro, y el KPI usa la misma definición. B) primera corrida global. C) contar corridas.
5. **Días:** A) hora de Chile. B) UTC, como hoy.

## Supuestos sin validar

| ID | Supuesto |
|---|---|
| H-1 | Las opciones de Modelo y Prompt no se recortan entre sí; una combinación sin datos se resuelve con el estado vacío. |
| H-2 | Con filtros, "Lotes con error" sigue agrupando por `run_label`, como hoy. |
| H-3 | Cuando Exportar CSV sea real, deberá respetar los filtros. Hoy solo muestra un aviso. |
