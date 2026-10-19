# Estado del proceso UX · Front de Call Audit

- **Estado:** **proceso UX cerrado** (2026-10-16) · **Cambio 09 aprobado** (2026-10-19, `09-cambio-auditoria-ia.md` §0). Fases 0 a 8 aprobadas por Johannes. El diseño está listo para implementar en `frontend/`; los cambios posteriores pasan por la revisión rápida contra lo aprobado.
- **Ubicación de los artefactos:** `call-audit/docs/ux/call-audit/` (dentro del repo, junto al resto de `docs/`).
- **Aprueba los gates:** Johannes (D-04).

## Aprobaciones

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| 0 · Brief | **Aprobada con cambios** | 2026-10-14 | Decisiones D-01 a D-17 en `00-brief.md` §0 |
| 1 · Investigación | **Aprobada** | 2026-10-14 | Johannes: "sí, apruebo la fase 1, todo bien entendido". Confirma la lectura de D-09, D-10 y D-12 |
| 2 · Ideación | **Aprobada** | 2026-10-15 | Johannes: "apruebo todo" (incluye D-18 y D-19) |
| 3 · Arquitectura de información | **Aprobada** | 2026-10-15 | Johannes: "apruebo". Navegación por rol y glosario sin cambios |
| 4 · User flows | **Aprobada** | 2026-10-15 | Johannes: "ok, avísame cuando termine". Valores por defecto aceptados (H-36 a H-39) |
| 5 · Patrones y navegación | **Aprobada** | 2026-10-15 | Johannes: "apruebo". Incluye la librería (H-42) |
| 6 · UX writing | **Aprobada** | 2026-10-15 | Johannes: "apruebo". Trato de "tú" (H-44) |
| 7 · Prototipado | **Aprobada** | 2026-10-16 | Johannes: "apruebo fase 7". Incluye C-02 a C-13. Test con usuarios: no por ahora (D-21) |
| 8 · Alta fidelidad | **Aprobada** | 2026-10-16 | Johannes: "apruebo". Cierra el proceso UX · `08-prototipo-alta-fidelidad.html`, `08-design-system.html`, `08-tokens.css/.json`, `08-alta-fidelidad.md` |

## Decisiones tomadas

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-10-13 | Artefactos UX dentro del repo `call-audit` en `docs/ux/call-audit/` | Diseñador |
| 2026-10-13 | Para BancoEstado manda la pauta de 33 motivos sin puntaje ni pesos | `docs/user-stories-auditor-supervisor.md` |
| 2026-10-13 | El prototipo v2 y el diagrama del zip son una solución candidata, no un diseño aprobado | Diseñador |
| 2026-10-14 | D-01 · MVP del front: solo el rol auditor | Johannes |
| 2026-10-14 | D-02 · Detalle de llamada y ficha del seguro a mano durante la revisión | Johannes |
| 2026-10-14 | D-03 · Base visual `app.css` (teal, radios suaves) con marca Qubico; solo existe el logo | Johannes |
| 2026-10-14 | D-04 · Johannes aprueba todos los gates | Johannes |
| 2026-10-14 | D-05 · SSO y cuentas propias, solo con autorización (sin auto-registro) | Johannes |
| 2026-10-14 | D-06 · Chrome o Edge, con audífonos | Johannes |
| 2026-10-14 | D-07 · El auditor ve el nombre del ejecutivo en la cola y puede filtrar y buscar por él (revierte H-07; riesgo en L-18) | Johannes |
| 2026-10-14 | D-08 · El supervisor entra al MVP para cerrar el hueco de escalamientos y reaperturas (alcance exacto por confirmar; se recomiendan dos olas) | Johannes |
| 2026-10-14 | D-09 · Proceso UX completo | Johannes |
| 2026-10-14 | D-10 · Supervisor con todas sus HU MVP de una vez (opción c) | Johannes |
| 2026-10-14 | D-11 · Auditores = personal del cliente; hoy escuchan el audio completo en una herramienta interna y anotan por minuto solo los incumplimientos | Johannes |
| 2026-10-14 | D-12 · Autorizan cuentas Qubico o el cliente; el supervisor crea auditores; solo Qubico crea supervisores | Johannes |
| 2026-10-14 | D-13 · Log de acceso para búsquedas y filtros por ejecutivo | Johannes |
| 2026-10-14 | D-14 · Logo Qubico disponible (PNG), referencia para la Fase 8 | Johannes |
| 2026-10-14 | D-15 · El supervisor aprueba todas las revisiones; el % de muestreo configurable queda como `Post` (resuelve #22) | Johannes |
| 2026-10-14 | D-16 · Sin entrevistas y sin cantidad conocida de usuarios: proto-personas definitivas, validación en la Fase 7 | Johannes |
| 2026-10-14 | D-17 · SSO desconocido: login agnóstico; registrado como #25 | Johannes |
| 2026-10-14 | Por defecto: Qubico crea supervisores por script (H-27); el logo se adapta desde el PNG (H-28) | Diseñador |
| 2026-10-14 | Fase 1 aprobada; confirmadas las lecturas: proceso completo, supervisor con todas sus HU MVP, gestión de auditores en la app | Johannes |
| 2026-10-15 | D-18 · Los hallazgos "cumple" quedan como "aceptados sin cambios" al guardar, sin confirmación explícita; el registro distingue revisado con acción de aceptado sin cambios (O-02) | Johannes |
| 2026-10-15 | D-19 · Aprobación en lote del supervisor: solo el carril sin señales, resumen previo, tope de 50, marca "aprobado en lote" (O-08) | Johannes |
| 2026-10-15 | Fase 2 aprobada | Johannes |
| 2026-10-15 | Fase 3 aprobada sin cambios (navegación y glosario) | Johannes |
| 2026-10-15 | H-34 (estado `awaiting_approval`) se usa en el diseño; queda pendiente de validar con `pipeline-architect`, sin bloquear | Coordinador / Johannes |
| 2026-10-15 | Fase 4 aprobada con valores por defecto: 30 min de inactividad, 60 s de revisión rápida, 10 s para deshacer el lote, edición hasta la aprobación del supervisor | Johannes |
| 2026-10-15 | Fase 5 aprobada; librería: shadcn/ui + Radix + Tailwind, TanStack Table/Virtual, wavesurfer.js, cmdk, Lucide | Johannes |
| 2026-10-15 | Fase 6 aprobada, con trato de "tú" | Johannes |
| 2026-10-16 | Fase 7 aprobada con C-02 a C-13 | Johannes |
| 2026-10-16 | D-20 · Por motivo: Cumple / Incumple / Dudoso, sin "No aplica" (si la situación no se dio, Cumple). Por llamada se mantiene Cumple / No cumple / Dudosa | Johannes (llamada: diseñador) |
| 2026-10-16 | D-21 · Sin test con usuarios por ahora; el plan queda documentado en `07-prototipado.md` | Johannes |
| 2026-10-16 | Fase 8 aprobada; proceso UX cerrado | Johannes |
| 2026-10-19 | Cambio 09 (revisión rápida): se aprueban con ajustes los puntos 1–4 para esta semana y 5–7 para después; rol nuevo Calidad de la IA; sección Discrepancias; prompt visible anonimizado; notas; revisión a ciegas del auditor frente al veredicto del cliente | Diseñador; confirmado por Johannes (D-22 a D-25) |
| 2026-10-19 | Vocabulario: el veredicto del cliente se muestra como Cumple / No cumple (no aprobado / rechazado); ramas: Coinciden · Solo la IA detectó · Omitidos por la IA · IA dudosa | Diseñador |
| 2026-10-19 | D-22 · Vero y el equipo externo entran como Auditor con `view_model_io`; no ven Discrepancias | Johannes |
| 2026-10-19 | D-23 · Sin rol "Calidad de la IA" en el MVP; Discrepancias y su clasificación quedan en Supervisor | Diseñador (supuesto, H-57) |
| 2026-10-19 | D-24 · El auditor nunca ve el veredicto ni el comentario del cliente | Diseñador |
| 2026-10-19 | D-25 · El veredicto del cliente es opcional: no viene / por llamada / por llamada + motivo; más un comentario opcional; el backend lo pasa si viene | Johannes |
| 2026-10-19 | Cambio 10 (revisión rápida, `10-modo-real.md`): modo real aprobado con cambios; acciones sin backend se ocultan en vez de fallar; L-28 condiciona el uso con datos reales; nuevo L-33 | Diseñador; pendiente de confirmación de Johannes |
| 2026-10-14 | En los artefactos solo se usan métricas agregadas de las transcripciones reales; los prototipos usan contenido sintético (L-19) | Diseñador |

## Preguntas abiertas

Ninguna bloqueante.

## Pendientes no bloqueantes

- H-34: validar `awaiting_approval` con `pipeline-architect`.
- H-48: `not_applicable` en el contrato y en el prompt de la capa 2 vs D-20 (`pipeline-architect`, `rubric-engineer`).
- H-32: mapeo motivo → sección de la ficha como configuración (`rubric-engineer`).
- Actualizar HU-AUD-03 en `docs/user-stories-auditor-supervisor.md` (sin "No aplica").
- SVG oficial del logo (H-28).
- Verificar la licencia del design system "Modernist" del zip (L-13).
- ADR del prompt único vs las capas de `CLAUDE.md` (`pipeline-architect`, H-52).
- L-28: no desplegar datos reales a externos sin enmascarado ni DPA.
