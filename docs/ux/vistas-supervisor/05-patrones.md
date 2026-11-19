# Fase 5 · Patrones de diseño y navegación · Calidad del servicio

Fecha: 2026-11-17 · Estado: **pendiente de aprobación** (va junto con la Fase 6).
Base: D-01 a D-20 (`estado.md`), flujos en `04-user-flows.md`. Se reutiliza lo aprobado en `docs/ux/call-audit/05-patrones.md` y `08-tokens.css`: shadcn/ui + Radix + Tailwind, TanStack Table, Lucide. Solo se documenta lo nuevo o lo que cambia.

---

## 1. Modelo de navegación

- **Sidebar existente** (`sidebar-nav.tsx`) + **pestañas de sección** bajo el `PageHeader`, con el mismo patrón que `/admin/stats` y `/admin/discrepancies` (`role="tablist"`). Cada pestaña es una ruta propia (D-04), no un `?tab=`, para que "Atrás" funcione y se pueda compartir el enlace.
- **Hub & spoke de profundidad 3:** pestaña → detalle (`[id]`) → `/analysis/calls` → `/calls/[id]`. Migas de pan solo desde el nivel 2 ("Calidad del servicio › Motivos › Motivo 14").
- **Sidebar por rol:**
  - **supervisor (modo real):** "Inicio" → **"Calidad del servicio"** (destino al entrar, D-20) → Alertas → Revisiones → Cola. Se quitan "Ejecutivos", "Motivos" y "Auditores", que redirigen (D-04), y "Discrepancias" (D-11).
  - **qubico_admin / qubico_viewer:** se suma "Calidad del servicio" debajo de "Análisis de discrepancias" (D-13).
  - **Modo demo:** sin cambios.
- **Pestañas visibles por rol:**
  - supervisor: Motivos · Ejecutivos · Informes.
  - Qubico: Motivos · Ejecutivos · Evaluadores · Informes.
  - Ola 2: Tipos de llamada y Casos inconsistentes.

## 2. Catálogo de patrones

| Patrón | Dónde | Por qué | Base existente |
|---|---|---|---|
| **Banda de la foto** (texto + chip de corrida) | Arriba de todas las pestañas | K-03, D-08, D-18 | `PageHeader` `description` |
| **Barra de filtros globales** (2 `select`: Tipo de seguro, Flujo) + "Quitar filtros" | Motivos, Ejecutivos, detalles | D-03; sus valores van a la URL | Filtros de `/admin/stats` (`admin-stats-filters`) |
| **Tabla agrupada por bloque** (5 encabezados de grupo, 33 filas) | Motivos | La pauta se piensa por bloques | `.tbl` de `/dashboard/criteria` |
| **Barras pareadas IA / planilla** por fila (dos barras horizontales finas, con valor en texto al lado) + columna "Diferencia" en puntos con signo | Motivos, Ejecutivos, detalle de motivo | W-03, D-02. El número siempre en texto: la barra solo apoya la lectura | Nuevo, sencillo (div con ancho %). Mismo estilo de `FixBar` |
| **Etiqueta de estado del criterio** (`StatusBadge`): "Parejo" (neutro) · "Se marca distinto" (ámbar, ícono) · "Explicado por los datos" (neutro, ícono `Info`) | Motivos, detalle | D-06, D-10 | `StatusBadge` |
| **Desvío contra el equipo** como texto con signo ("+12 pts sobre el equipo") y flecha; sin posiciones ni medallas | Ejecutivos, Evaluadores | D-07: sin ranking | `flag()` de `auditors/page.tsx` |
| **Marca "pocas llamadas"** en texto secundario + fila atenuada | Todas las tablas | D-07, S-04 | Cambio 20 §7 |
| **Ayuda visible bajo cada tabla** (2–4 líneas), sin tooltip | Todas | La app no tiene tooltip accesible (Cambio 20) | Cambio 20 §7 |
| **Cifra-enlace**: cada número clicable es un `<a>` a `/analysis/calls?…` con subrayado al pasar el puntero y al enfocar | Todas | O-05, K-04 | Nuevo, trivial |
| **Mapa tipo × flujo** (heatmap con el número en la celda) | Detalle de motivo | Dónde se concentra el problema | Heatmap de `/dashboard/criteria` |
| **Ficha de ejecutivo**: perfil por motivo (solo los 10 con mayor desvío por defecto + "Ver los 33") y sus llamadas | `/analysis/agents/[id]` | Evita 33 filas para leer 3 | Nuevo, con `.tbl` |
| **Lista de llamadas** paginada en el servidor (50 por página), con la condición de origen como encabezado ("Motivo 14 · No cumple según la IA · Desempleo") | `/analysis/calls` | D-17 | Listas de `/reviews` y `/discrepancies` |
| **Banner de origen + inicio en el minuto** en el detalle de llamada | `/calls/[id]?from=analysis&criterion=N&t=…` | Flujo §1. `use-audio.ts` ya permite saltar a un punto; falta leer `t` | Banner D-58 (`serie`) |
| **Lector de Markdown** con encabezado (título, fecha, corrida, audiencia) y aviso si la corrida difiere | `/analysis/reports/[slug]` | D-09, D-16 | Nuevo. Markdown sin HTML crudo |
| **Estados vacío, carga y error** | Todas | S-01 a S-07 | `AsyncView`, `EmptyState`, `LoadingState` |
| **Detalle técnico plegado** ("Detalle técnico: kappa por motivo"), cerrado por defecto | `/analysis/evaluators/[id]` | D-06 | `<details>`, como el mapa de prioridad (D-82) |

**Orden por defecto:**
- **Motivos:** por bloque y, dentro de cada bloque, por |Diferencia| de mayor a menor. Los "Explicado por los datos" van al final del bloque.
- **Ejecutivos:** por desvío según la IA de mayor a menor; con "pocas llamadas" y motivo 25 al final (D-10).
- **Evaluadores:** por desacuerdo de mayor a menor.
- Todas las columnas se pueden ordenar con `aria-sort`.

**Sin gráficos nuevos de librería en la ola 1:** solo barras con `div` y heatmap con tabla. Así el equipo backend-first no tiene que mantener una librería de gráficos.

## 3. Colores de las fuentes

| Fuente | Color | Forma (para no depender del color) |
|---|---|---|
| Según la IA | `--series-1` (azul, 4,42:1) | Barra sólida + ícono `Sparkles` en el encabezado |
| Según la planilla | `--series-2` (óxido, 4,65:1) | Barra con borde y relleno al 40 % + ícono `Building2` (el mismo de `SourceBadge client`) |

- No se usan rojo ni verde para las fuentes: en la app significan Incumple/Cumple.
- La diferencia no tiene color: se muestra con signo y la palabra ("+9 pts la planilla").

## 4. Anti-patrones prohibidos en esta sección

- Rankings con posiciones, medallas, "top/bottom N" o "peor ejecutivo" (D-07; regla no negociable 5).
- Una sola cifra que mezcle la IA y la planilla (D-02).
- Una cifra sin base o sin fuente (K-03).
- Colores rojo/verde para personas.
- Tooltips como única vía para una definición.
- Auto-refresco que cambie cifras mientras se presenta (D-19).
- Revelar que existe un informe interno o la pestaña Evaluadores a quien no la ve: el enlace directo responde "no encontrado".
- Confirmshaming, urgencia falsa y demás dark patterns (no aplican a una sección de solo lectura, pero quedan prohibidos).

## 5. Accesibilidad (WCAG 2.2 AA)

| Criterio | Cómo se cumple |
|---|---|
| 1.4.1 Uso del color | Fuente con ícono + texto; diferencia y desvío con signo y palabra; estado del criterio con texto |
| 1.4.3 / 1.4.11 Contraste | Texto con `--foreground` y `--muted-foreground`. Barras `--series-1/2` ≥ 3:1 contra el blanco. La fila atenuada de "pocas llamadas" baja la opacidad del fondo, **no** la del texto (mínimo `--neutral-700`) |
| 1.3.1 Información y relaciones | `<table>` real con `<th scope>`, encabezados de grupo por bloque (`<tbody>` con `<th colspan>`), `<caption>` visualmente oculto con el filtro activo |
| Barras | `aria-hidden` en la barra; el valor va en texto en la misma celda |
| Heatmap tipo × flujo | Número dentro de cada celda; `aria-label` de la tabla con el motivo |
| 2.1.1 Teclado / 2.4.7 Foco | Pestañas con flechas (patrón Radix Tabs), cifras-enlace en orden de tabulación, foco de 2 px `--ring` |
| 2.4.11 Foco no oculto | Encabezado fijo de la tabla sin tapar la fila enfocada (`scroll-margin-top`) |
| 2.5.8 Tamaño del objetivo | Cifras-enlace con área mínima de 24×24 px (padding en la celda) |
| 3.2.3 Navegación coherente | Mismas pestañas y misma banda de la foto en todas las vistas |
| 4.1.3 Mensajes de estado | Cambio de filtro → `role="status"` "Mostrando {n} motivos con {filtro}" |

## 6. Referencias de plataforma

Web de escritorio (Chrome/Edge, D-06 de call-audit). Patrones de Radix (Tabs, Select) y de las guías de tablas de datos de Material Design como referencia para la densidad y el orden. Sin patrones móviles.
