# Acuerdo en motivos dentro de «Coincide con el revisor» · Brief (gate único)

- **Fecha:** 2026-11-16 · **Pide:** Johannes (vía coordinador).
- **Tipo:** cambio menor sobre lo aprobado en `02-mosaico-propuesta.md` (mosaico, colores E3) y `05-numeros-propuesta.md`
  (N-R5 «las partes suman el todo», N-R6 «una cifra, un significado»). Un gate: decisiones M1-M5. Sin código de UI aún.
- **Fuera:** temas legales y anonimización (instrucción de Johannes).

## 1. Problema

Hoy una llamada es **«Coincide con el revisor»** (verde) si IA y revisor dan el mismo veredicto final, aunque rechacen por
motivos distintos (regla explícita en `02` §2.1 y `SEGMENT_SUPPORT.agree`). El verde, por lo tanto, sobrestima el acuerdo real
cuando ambos rechazan: en v3.0 solo 1 de cada 3 rechazos compartidos coincide en todos los motivos.

- **P-20** El verde mezcla «coincide en todo» con «coincide en el veredicto, pero por otras razones».
- **O-20** Ver, sin tocar el mosaico, cuánto del verde es acuerdo pleno y cuánto es desacuerdo en motivo de rechazo.

## 2. Qué se pide y qué no

| Sí | No |
|---|---|
| Un gráfico **nuevo y aparte**, solo con las llamadas «Coincide con el revisor» | Cambiar el mosaico, sus colores, sus reglas ni las tarjetas/metas |
| Partido en «coinciden también en motivos» y «Desacuerdo en motivo de rechazo» | Cambiar el análisis de discrepancias (la cuarta IA ya ve llamada × motivo) |
| Colores distintos a los del mosaico | Nuevas corridas con IA (es solo visualización sobre datos existentes) |

## 3. Datos de referencia (corrida completa v3.0, 1.100 llamadas)

| Tramo | Llamadas | % del verde (709) | % del total (1.100) |
|---|---|---|---|
| Ambos aprueban (sin motivos que comparar) | 307 | 43,3 % | 27,9 % |
| Ambos rechazan, mismos motivos | 134 | 18,9 % | 12,2 % |
| Ambos rechazan, algún motivo en común pero no todos | 155 | 21,9 % | 14,1 % |
| Ambos rechazan, ningún motivo en común | 113 | 15,9 % | 10,3 % |
| **Total verde** | **709** | 100 % | 64,5 % |

Fuera del gráfico (siguen en el mosaico): revisor cumple / IA rechaza 237, revisor rechaza / IA cumple 140, IA dudosa 14.

Lectura clave: de los **402** rechazos compartidos, **134 (33 %)** coinciden en todos los motivos y **268 (67 %)** difieren en al
menos uno; 113 (28 %) no comparten ninguno.

## 4. Definiciones propuestas (para desarrollo; sobre `call_rows`, solo `segment = "agree"`)

Por llamada, con `ai_fails` y `ref_fails` (mismo criterio que `call_rows`: «No aplica» de la IA = Cumple):

| Tramo | Regla |
|---|---|
| Ambos aprueban | `ref_fails` vacío (y `ai_fails` vacío por veredicto) |
| Mismos motivos | `ai_fails == ref_fails`, no vacío |
| Desacuerdo parcial | intersección no vacía y conjuntos distintos |
| Desacuerdo total | intersección vacía, ambos no vacíos |

- Suma = `byCall.agree` (N-R5). Mismo universo que el mosaico al que acompaña (N-R6).
- **[SUPUESTO] H-M1:** un motivo que la IA marcó **dudoso** dentro de una llamada con veredicto coincidente no cuenta como motivo
  de rechazo de la IA (si el revisor lo rechaza, es un «no en común»). Validar con Johannes viendo 3-5 casos.
- **[SUPUESTO] H-M2:** «Ambos aprueban» siempre coincide en todo (veredicto Cumple ⇒ sin motivos marcados por ninguno). Si
  existiera un Cumple con motivos marcados, cae en el tramo que le toque por regla.

## 5. Forma propuesta (para orientar las decisiones; se detalla tras el gate)

Barra horizontal única al 100 % **del verde**, debajo del mosaico, con la misma convención de «zoom» que el Gráfico B
(`DisagreementZoom`): rótulo «vistas al 100 %», borde en zigzag, y dos cifras por tramo (% del verde en la barra, % del total y
«N de 709» en la línea de abajo). Tablas alternativas (`AsTable`) y resumen `role="img"` como el resto de los gráficos.

```
Dentro de «Coincide con el revisor» · 709 llamadas, vistas al 100 %
┌──────────────────────┬──────────┬───────────┬────────┐
│ Ambos aprueban 43 %  │ Mismos   │ Desacuerdo│Desac.  │
│                      │ motivos  │ parcial   │total   │
│                      │ 19 %     │ 22 %      │ 16 %   │
└──────────────────────┴──────────┴───────────┴────────┘
 Coinciden en todo 62 % (441)      Desacuerdo en motivo de rechazo 38 % (268)
```

## 6. Decisiones M1-M5

Ver `estado.md` (sección «Acuerdo en motivos») y la respuesta del diseñador al coordinador.

| ID | Decisión | Recomendación |
|---|---|---|
| M1 | Qué cuenta como «Desacuerdo en motivo de rechazo» | A: cualquier diferencia, mostrada en dos tramos (parcial y total) |
| M2 | «Ambos aprueban» como tramo propio o sumado a «mismos motivos» | A: tramo propio |
| M3 | Dónde va el gráfico | A: bajo el mosaico en pestaña Prueba y en Calidad de la IA; no en Verificación ni Discrepancias |
| M4 | Colores | A: verdes para acuerdo pleno, violeta para desacuerdo en motivo |
| M5 | Tramos con enlace a la lista de llamadas | A: sí, cada tramo abre su lista |

## 7. Riesgos

- **R-M1** Leer «38 % en desacuerdo» como 38 % del total: se mitiga titulando con el universo («dentro de las 709 que
  coinciden») y mostrando siempre el % del total al lado.
- **R-M2** Confundir el violeta con el azul rayado del revisor: el violeta va sin rayado y nunca en el mosaico.
- **R-M3** En la serie parcial en curso (`14`), con pocas llamadas los tramos bailan; se aplica el mismo mínimo de 20.

---

# Propuesta de detalle (M1-M5 aprobadas, todas A; H-M1 y H-M2 aprobados · 2026-11-16)

## 8. Regla final (backend)

Por llamada con `segment = "agree"`, sobre los motivos de la pauta (`criteria`):

- `ai = (failCriteria − uncertainCriteria) ∩ criteria` (H-M1: lo dudoso no cuenta como rechazo de la IA). `ref = externalFails ∩ criteria`.
- `reasonMatch`:
  - `"bothPass"`: `ai` y `ref` vacíos.
  - `"same"`: `ai == ref`, no vacíos.
  - `"partial"`: `ai ∩ ref` no vacío y `ai != ref`.
  - `"none"`: `ai ∩ ref` vacío y al menos uno no vacío (H-M2: si uno queda vacío también es «none»).
- Otras partes del mosaico: `reasonMatch = null`.
- Invariante (test): `bothPass + same + partial + none = byCall.agree`.

## 9. Microcopy

| Lugar | Texto |
|---|---|
| Título (h4, con [?]) | **¿Coinciden también en los motivos?** |
| Subtítulo | Dentro de «Coincide con el revisor» · **709 llamadas, vistas al 100 %** |
| Ayuda [?] | Una llamada coincide con el revisor si ambos dan el mismo veredicto, aunque rechacen por motivos distintos. Este gráfico separa esas llamadas según sus motivos de rechazo. Un motivo que la IA dejó dudoso no cuenta como rechazo de la IA. |
| Tramos | **Ambos aprueban** · **Mismos motivos** · **Desacuerdo parcial** · **Desacuerdo total** |
| Rótulos de grupo (bajo la barra) | **Coinciden en todo · 62 % (441)** · **Desacuerdo en motivo de rechazo · 38 % (268)** |
| Línea clave (bajo los grupos) | De los **402** rechazos en que coinciden, **134 (33 %)** marcan los mismos motivos. |
| Leyenda (por tramo) | swatch + nombre + «19 % · 134 de 709 · 12,2 % del total» |
| Resumen `role="img"` | «De 709 llamadas que coinciden con el revisor: 307 ambos aprueban, 134 con los mismos motivos, 155 con desacuerdo parcial y 113 con desacuerdo total en los motivos de rechazo.» |
| Tabla alternativa (`AsTable`) | Columnas: Tramo · Llamadas · % de las que coinciden · % del total |

Listas (`LIST_NAME` / `SEGMENT_SUPPORT`):

| Lista | Título | Línea de apoyo |
|---|---|---|
| `agreePass` | Coincide · Ambos aprueban | la IA y el revisor dicen que cumple: no hay motivos que comparar |
| `agreeSame` | Coincide · Mismos motivos | ambos rechazan y marcan exactamente los mismos motivos |
| `agreePartial` | Coincide · Desacuerdo parcial en motivos | ambos rechazan; comparten al menos un motivo, pero no todos |
| `agreeNone` | Coincide · Desacuerdo total en motivos | ambos rechazan, pero sin ningún motivo en común |

## 10. Colores (contraste calculado, WCAG 2.2 AA)

| Tramo | Token | Relleno | Texto encima | Borde | Contrastes |
|---|---|---|---|---|---|
| Ambos aprueban | `--reason-pass-bg` / `--reason-pass-border` | #cde9db | `--ink-900` | 1 px #0f7a55 | texto 12,83:1 · borde vs blanco 5,34:1 |
| Mismos motivos | `--reason-same-bg` | `var(--agree-bg)` #0f7a55 | blanco | — | 5,34:1 |
| Desacuerdo parcial | `--reason-partial-bg` / `--reason-partial-border` | #ddd2f3 | `--ink-900` | 1 px #6b46b8 | texto 11,5:1 · borde vs blanco 6,58:1 |
| Desacuerdo total | `--reason-none-bg` | #5b3a9e | blanco | — | 8,26:1 |

- Sin rayado (exclusivo del azul del revisor, R-M2).
- Vecinos claros entre sí (1,12:1): se separan con 2 px blancos y los bordes, igual que el mosaico; nombres siempre en texto (1.4.1).
- Rótulo dentro del tramo con las reglas del mosaico (ancho ≥ 56 px y alto ≥ 32 px); tramo > 0 nunca bajo 4 px.

## 11. Estados

| Estado | Qué se ve |
|---|---|
| Sin planilla por motivo (`agreement = null`) o sin `reasonMatch` | No se muestra |
| `byCall.agree = 0` | Título + «Ninguna llamada coincide con el revisor en esta prueba.», sin barra |
| Sin rechazos en común (`same + partial + none = 0`) | Barra solo con «Ambos aprueban»; línea clave: «No hay rechazos en común con el revisor.» |
| Serie parcial en curso (`14`) | Igual que el mosaico: bajo 20 llamadas no se muestra; sobre eso, mismo aviso de cifras parciales |
| Pruebas antiguas | Se calcula desde los resultados guardados: aplica a todas sin re-correr IA |

## 12. Lista de implementación

### Backend

1. `src/call_audit/agreement.py`
   - `REASON_MATCH = ("bothPass", "same", "partial", "none")` y `reason_match(ai: set[int], ref: set[int]) -> str` (§8).
   - `call_rows`: en cada fila `"reasonMatch"` = `reason_match(...)` si `segment == "agree"`, si no `None`.
   - `compute_rows`: bloque `"reasonMatch": {"n": <agree>, "bothPass", "same", "partial", "none"}` contado desde las filas.
2. `src/call_audit/verification.py`
   - `AGREE_PARTS = {"agreePass": "bothPass", "agreeSame": "same", "agreePartial": "partial", "agreeNone": "none"}`; sus claves a `LISTS`.
   - `matches()`: si `segment in AGREE_PARTS` → `row["segment"] == "agree" and row["reasonMatch"] == AGREE_PARTS[segment]` (y, con `criterion`, además el desacuerdo en ese motivo).
3. `src/call_audit/api/routes_admin.py` (~486): agregar las 4 listas al `Literal` `Segment`.
4. Tests: `tests/test_agreement.py` (un caso por tramo; H-M1; suma = `byCall.agree`; `None` fuera de `agree`) y `tests/test_verification.py` (`matches` con las listas nuevas).

### Front

5. `frontend/src/lib/api/admin-types.ts`: `type ReasonMatch = "bothPass" | "same" | "partial" | "none"`; `Agreement.reasonMatch?: { n: number } & Record<ReasonMatch, number>`; `CallList` + `"agreePass" | "agreeSame" | "agreePartial" | "agreeNone"`.
6. `frontend/src/styles/tokens.css`: tokens `--reason-*` del §10.
7. `frontend/src/components/admin/agreement-charts.tsx`: `REASON_PARTS` (como `PARTS`) y `export function ReasonMatchBar({ version, a, linked })`: barra 32 px al 100 % de `reasonMatch.n`, convención de zoom de `DisagreementZoom` (zigzag, «vistas al 100 %»), grupos, línea clave, leyenda, `role="img"` + `aria-label`, `AsTable`; con `linked`, tramos y leyenda enlazan a `listHref(version, list)`. `Swatch` acepta `ReasonMatch`.
8. `frontend/src/components/admin/verification-labels.ts`: `LIST_NAME`, `SEGMENT_SUPPORT` (§9); `LIST_SWATCH` con tipo `AgreementSegment | ReasonMatch | null`. No tocar `SEGMENTS`.
9. Ubicación (M3 A): `prompt-version.tsx` (~356) entre `AgreementMosaic` y `DisagreementZoom`; `ai-quality.tsx` (~171) después de `AgreementMosaic`; mismo `linked` que el mosaico. No en `verification-view.tsx` ni `discrepancy-summary.tsx`.
10. `calls-list.tsx`: sin cambios de estructura; comprobar título, swatch y navegación caso a caso dentro de la lista nueva.

### Verificación

11. Corrida completa v3.0: 307 / 134 / 155 / 113 (suma 709). Navegador a 1600 px y 375 px, claro y oscuro, y resumen `role="img"`.
