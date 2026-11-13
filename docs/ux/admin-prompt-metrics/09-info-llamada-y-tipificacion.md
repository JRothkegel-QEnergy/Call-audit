# 09 · Datos de la llamada y tipificación del ejecutivo (pedido 2026-11-13)

Tipo: ajuste acotado sobre pantallas aprobadas (`04-verificacion-propuesta.md`, `07-ficha-en-caso.md` y el detalle de llamada del auditor). Un solo gate (T1-T4). Sin código de UI hasta aprobar. Sin temas legales (instrucción de Johannes).

## 1. Pedido

Johannes: "Me molesta que en la revisión no tenga la información de la llamada. Aparte que debería poder ver en todos lados qué motivo tipificó el ejecutivo."

## 2. Lo que hay hoy (leído en el código)

| | Revisión caso a caso del admin (`case-review.tsx`) | Detalle de llamada (`call-detail.tsx`) |
|---|---|---|
| Encabezado | «Llamada 000000 · 03 sep · 10:40 min · v2.15 (prueba de validación)»; IA vs Planilla; evaluador; comentario; estado | «Llamada X» · fecha y hora · «Ejecutivo X» · productos · «Decisión del motor» + badge · estado |
| Ficha del seguro | C1-C4 implementada en local, **no desplegada** (3.ª columna desde 1536 px, botón «Ficha del seguro» bajo eso) | Sí, con «Datos de la llamada» por seguro |
| Datos disponibles | Ya pide `api.getCase(caseId)`: trae `agent`, `products`, `callDate`, `durationMs`, `engineVerdict`, `customer`, `productSheets`. **No hace falta backend para ejecutivo y seguros** | idem |

**Tipificación hoy:**
- Viene en la metadata del lote (`TIPIFICACION`, `MOTIVO RENUNCIA`) y queda en `case.call_metadata["typification"] = [{mus_a_neto, outcome, reason}]` (una sola fila por grabación, `real_calls.build_call`).
- **No llega al front** en `CaseSummary` / `CaseDetail` ni en las listas. Solo se ve, como texto, dentro del panel «Modelo» (`model-panel.tsx`, `run.inputData`, sección «Llamada»: «Tipificación» y «Motivo de renuncia tipificado»), que es del admin.
- Dos caminos cuando falta `TIPIFICACION`:
  - Lotes nuevos (`pipeline.complete_row`): se rellena con `RETENCION` **antes** de construir la llamada, así que hoy no queda rastro de que fue asumida.
  - Importación del bench (`import_bench`): queda «NO INFORMADA» y los motivos 19-25 no se evalúan (`UNEVALUABLE_WITHOUT_TYPIFICATION`).

Parte de la primera queja («no tiene la información») se resuelve desplegando C1-C4: Johannes probablemente mira producción, donde la ficha aún no está.

## 3. Propuesta

### 3.1 Encabezado de la revisión, alineado con el del auditor

Mismo orden y mismas palabras que `call-detail.tsx`, más lo propio de la revisión:

```
[< Volver]  Llamada 000000   03 sep 2026 10:12 · Ejecutivo Juan Pérez · Desempleo Consumo · 10:40 min
            Tipificó: Retención · Motivo de renuncia: Problemas Económicos
            v2.15 (prueba de validación)   IA: Rechaza   Planilla: Cumple   Evaluador de la planilla: …   [estado]
            Comentario de la planilla: «…»
```

- Línea 1 (datos de la llamada): `shortDateTime(callDate)` (hoy usa `shortDate`, sin hora) · `Ejecutivo {agent.name}` · `products.join(", ")` · duración. Todo sale de `getCase`, ya pedido.
- Línea 2: tipificación (§3.2).
- Línea 3-4: lo que hay hoy (versión, IA vs Planilla, evaluador, estado, comentario), sin cambios.
- **No** se muestra «Decisión del motor» en la revisión (ver T2): la IA que importa aquí es la de la versión en prueba; poner también la del motor vigente invita a confundirlas.
- Bajo `md`, cada línea se parte en renglones; la tipificación siempre va en su propia línea.

### 3.2 Cómo se rotula la tipificación

Formato único en toda la app: **«Tipificó: {gestión} · Motivo de renuncia: {motivo}»**.

- Se usa «Motivo de renuncia» y no «Motivo» a secas: «motivo» ya es cada punto de la pauta (motivo 18, «desacuerdos por motivo»). «Motivo: Problemas Económicos» al lado de «Motivos en desacuerdo: 18» se lee mal.
- Gestión: `RETENCION` → «Retención», `RENUNCIA` → «Renuncia»; otro valor → primera letra en mayúscula, resto como viene. El motivo de renuncia se muestra tal como viene (la lista de 27 ya trae mayúsculas propias: «Problemas Económicos»).

| Caso | Texto |
|---|---|
| Ambos vienen | Tipificó: Retención · Motivo de renuncia: Problemas Económicos |
| Gestión asumida (lote nuevo sin `TIPIFICACION`) | Tipificó: Retención (asumida) · Motivo de renuncia: Problemas Económicos — con «?»: «El lote no trae la gestión tipificada; el sistema asume Retención.» |
| Gestión no informada (importación del bench) | Tipificó: no informado · Motivo de renuncia: Problemas Económicos — con «?»: «El lote no trae la gestión tipificada; los motivos 19 a 25 no se evalúan.» |
| Sin motivo de renuncia | Tipificó: Retención · Motivo de renuncia: no informado |
| Nada | Tipificación: no viene en el lote |

- «(asumida)» y «no informado» en `text-muted-foreground`, no en color de alerta: es un dato faltante, no un error del ejecutivo.
- Si la llamada tiene más de un seguro, la tipificación es una sola (la metadata trae una fila por grabación). No se repite por seguro ni se asigna a uno; si `mus_a_neto` viene, el «?» lo dice: «Tipificada sobre el seguro MUS {n}.» (H-T2).

### 3.3 Dónde aparece

| Pantalla | ¿Sí? | Dónde y por qué |
|---|---|---|
| Revisión caso a caso del admin | **Sí** | Línea 2 del encabezado. Es donde Johannes verifica los motivos 18-25. |
| Detalle de llamada (auditor, supervisor, admin) | **Sí** | Nueva línea bajo la cabecera, mismo texto. El auditor evalúa el 18 y no tiene hoy el dato fuera del audio. Visible para todos los roles (no es el veredicto del cliente, D-24 no aplica). |
| Lista de llamadas por segmento (`calls-list.tsx`) | **Sí, columna** | Columna «Tipificó» con el texto corto «Retención · Problemas Económicos» (sin rótulos, truncado con `title`). Permite ver patrones del 18 sin abrir cada caso. |
| Análisis por caso (`case-grid.tsx`, mosaico) | No en la celda | No hay espacio; solo en el tooltip / `aria-label` de la celda, con el texto corto. El clic ya lleva a la revisión. |
| Cola del auditor | No | Sirve para elegir el siguiente caso; la tipificación no cambia ese orden y suma ruido a una tabla densa. Se ve al abrir el caso. |
| Detalle de patrón de Discrepancias | Después | Útil solo en patrones de los motivos 18-25. Lo está tocando otro diseñador (08); queda como pendiente a coordinar, no entra en esta entrega. |
| Panel «Modelo» | Ya está | Se deja como está (es lo que vio la IA). |

### 3.4 Backend mínimo (sin IA)

1. **Marcar la gestión asumida** en `pipeline.complete_row`: además de poner `RETENCION`, guardar `row["_TIPIFICACION_ASUMIDA"] = True` y llevarlo a `call_metadata["typification"][0]["assumed"] = True` al importar. Solo afecta lotes nuevos.
2. **Serializar** un bloque común `typification: {outcome: str | null, reason: str | null, assumed: bool, musANeto: str | null} | null` desde `call_metadata["typification"][0]` («NO INFORMADA» o vacío → `null`):
   - en `case_detail` (`serializers.py`) → `CaseDetail.typification` (revisión y detalle de llamada);
   - en los ítems de `verification.segment_calls` (lista por segmento) y de `GET /api/admin/quality/grid` (tooltip del mosaico).
   - No en `CaseSummary` (la cola no lo usa).
3. **Front**: un helper `typificationLabel(t, {short})` en `lib/` con las reglas de §3.2, usado en las cuatro pantallas.
4. **Llamadas ya importadas por el pipeline**: no se puede saber si su «Retención» fue asumida. Se muestran como «Retención» sin marca (H-T1), salvo que se rellene desde la fila original guardada en `output/` (ver T4).

## 4. Supuestos y riesgos

- **H-T1:** las llamadas ya cargadas por el pipeline sin `TIPIFICACION` se verán como «Retención» sin «(asumida)». Riesgo: Johannes lea como tipificado algo que el sistema supuso. Se mitiga con T4 B si la fila original se guardó sin rellenar.
- **H-T2:** `mus_a_neto` de la tipificación coincide con el de un seguro de la ficha. Si no, el «?» lo menciona igual, sin enlazar.
- **R-T1:** en la columna de la lista, el motivo de renuncia puede ser largo («Cliente posee otro seguro con similares coberturas»); se trunca con `title` y no se parte en dos líneas.
- Ningún cambio toca los archivos 08 ni el Resumen de Discrepancias.

## 5. Decisiones (gate)

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| **T1** | Rótulo | A: «Tipificó: Retención · Motivo de renuncia: Problemas Económicos» · B: «Tipificó: Retención · Motivo: Problemas Económicos» (más corto, choca con «motivo» de la pauta) | **A** |
| **T2** | Encabezado de la revisión | A: datos de la llamada como el auditor (fecha y hora, ejecutivo, seguros, duración) **sin** «Decisión del motor» · B: igual que el auditor, con «Decisión del motor» | **A** |
| **T3** | Dónde aparece | A: revisión, detalle de llamada, lista por segmento (columna) y tooltip del mosaico; cola no; Discrepancias después · B: solo revisión y detalle de llamada | **A** |
| **T4** | Llamadas ya cargadas con «Retención» asumida | A: solo marcar desde ahora (H-T1) · B: además, rellenar la marca leyendo la fila original guardada en `output/`, si existe sin rellenar (sin IA, sin costo) | **A**, y B solo si al revisar `output/` la fila viene sin rellenar |

Además: desplegar C1-C4 (Ficha del seguro en la revisión), que ya está en local y resuelve la otra mitad de la queja.
