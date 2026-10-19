# Fase 0 · Brief y encuadre · Front de Call Audit

> Estado: **aprobado con cambios** (2026-10-14, Johannes; ampliado el mismo día con D-08 a D-14). Los cambios del gate están en la sección 0 y prevalecen sobre el resto del documento.

## 0. Decisiones del gate (2026-10-14)

| # | Decisión del usuario | Efecto en el brief |
|---|---|---|
| D-01 | **El MVP del front es solo el rol auditor.** | Supervisor, admin de calidad y operación quedan fuera del MVP del front. Reemplaza el "Qué sí" de la sección 4 |
| D-02 | En la revisión, **el detalle de la llamada y los datos del seguro (ficha de producto) deben estar a mano**. | El detalle muestra la ficha de cada seguro que viene en la llamada (`data/catalog/products.json`, plantilla de `docs/layer2-product-sheet.md`) sin salir de la pantalla de revisión |
| D-03 | Base visual: `app.css` (Modernist retocado, acento teal, superficies blancas, radios suaves), **con marca Qubico**. No existe marca aún, solo logo. | La Fase 8 define una identidad mínima a partir del logo. Hace falta el archivo del logo |
| D-04 | **Johannes aprueba todos los gates de diseño.** | Stakeholder único de aprobación |
| D-05 | Acceso por **SSO y por cuentas propias**, **solo con autorización**: no hay auto-registro. | Login sin "crear cuenta"; alta por invitación o aprovisionamiento. Ver L-11 y L-17 |
| D-06 | Navegador **Chrome o Edge, con audífonos**. | Confirma H-01 en lo que toca al navegador y al audio |
| D-07 | **El auditor ve el nombre del ejecutivo en la cola y puede filtrar y buscar por ejecutivo.** | Revierte H-07. Riesgo de sesgo y de focalización registrado en L-18 |

| D-08 | **El supervisor entra al MVP** (2026-10-14), para cerrar el hueco de los escalamientos y las reaperturas. Modifica D-01 | Falta definir el alcance exacto del supervisor (pregunta del gate de la Fase 1). Recomendación del diseñador en la sección "Alcance MVP actualizado" |

| D-09 | **Proceso UX completo** (no acelerado), 2026-10-14 | Se hacen todas las fases con sus entregables. El prototipo v2 sigue siendo una referencia, no un atajo |
| D-10 | **Supervisor: todas sus historias MVP de una vez** (opción c, 2026-10-14). Reemplaza la propuesta de dos olas | Entran HU-SUP-01 a 08 y HU-SUP-12 |
| D-11 | Los **auditores son personal del cliente** (del contact center). Hoy auditan con una **herramienta interna** en la que escuchan el audio completo y agregan observaciones minuto a minuto, solo cuando algo no cumple | Confirma H-06 (en parte) y H-03. Actualiza el journey actual |
| D-12 | **Alta de cuentas**: autoriza Qubico o alguien del cliente. **Los supervisores pueden crear auditores; solo Qubico crea supervisores** | Entra al MVP una gestión mínima de auditores para el supervisor. Cómo crea Qubico a los supervisores está por definir |
| D-13 | **Se acepta registrar en el log de acceso cada búsqueda o filtro por ejecutivo** | Cierra la mitigación de L-18 |
| D-14 | **Logo Qubico** disponible: PNG negro sobre blanco (símbolo de cubo con nodos + logotipo geométrico en mayúsculas), en `Qubico/src/qubico-cloud/frontend/src/assets/qubico-logo.png` | Solo como referencia para la Fase 8; no se copia al repo todavía. Faltan una versión vectorial (SVG) y una versión para fondo oscuro |
| D-15 | **El supervisor aprueba todas las revisiones** por ahora (resuelve #22). Más adelante podrá configurar un % de muestreo de revisiones aceptadas y rechazadas (`Post`) | La bandeja de revisiones del supervisor debe soportar volumen alto: aprobación eficiente, atajos de teclado, aprobación en lote con control. Riesgo de cuello de botella (ex H-21) |
| D-16 | **No se puede entrevistar a usuarios**, y no se sabe cuántos auditores ni supervisores hay | Las proto-personas quedan como definitivas para el proyecto; se validan en el test de la Fase 7 (si no hay acceso, con usuarios proxy) |
| D-17 | **No se sabe qué SSO usa el cliente** | Login agnóstico: botón "Ingresar con SSO" genérico + cuenta propia. Registrado como #25 en `client-open-questions.md` |

**Supuestos por defecto (sin respuesta; no bloquean):** Qubico crea a los supervisores con un **script o consola fuera de la app** (sin pantalla interna en el MVP); el logo se **adapta desde el PNG** en la Fase 8 (vectorización y versión para fondo oscuro).

Lo que sigue abierto: nada bloqueante para la Fase 2. Cantidad de usuarios desconocida (D-16); SSO pendiente (#25).

### Alcance MVP actualizado (reemplaza el "Qué sí" de la sección 4)

- **Auditor**: HU-AUD-01 (cola, con filtro y búsqueda por ejecutivo), HU-AUD-02 (detalle con audio, transcripción, checklist **y ficha del seguro**), HU-AUD-03 (confirmar o corregir), HU-AUD-04 (atajos y flujo continuo), HU-AUD-05 (escalar), HU-AUD-06 (mis revisiones), HU-AUD-07 (muestra de "cumple").
- **Transversal**: login (SSO o cuenta propia, sin auto-registro), enmascarado de PII, banner de hallazgos, trazabilidad visible.
- **Supervisor (D-08, D-10)**: **todas sus historias MVP**:
  - dashboard (HU-SUP-01);
  - motivos de no calidad (HU-SUP-02);
  - ejecutivos y ficha (HU-SUP-03);
  - feedback (HU-SUP-04);
  - alertas y escalamientos (HU-SUP-05);
  - revisiones de auditores (HU-SUP-06);
  - aprobar, reabrir o cambiar (HU-SUP-07);
  - desempeño de auditores (HU-SUP-08);
  - exportación (HU-SUP-12).

  El detalle de llamada es el mismo componente del auditor, en modo supervisor.
- **Gestión de usuarios (D-12)**:
  - el supervisor crea, desactiva y reactiva auditores de su empresa;
  - Qubico crea supervisores (está por definir si es por pantalla interna o por script).

  No hay auto-registro. Login por SSO o cuenta propia.
- **Riesgo de plazo**: el alcance completo del supervisor junto al auditor no cabe con holgura en las semanas 3–6 del plan. El orden de diseño e implementación propuesto es:
  1. auditor;
  2. control de la revisión del supervisor (HU-SUP-05/06/07);
  3. el resto del supervisor (HU-SUP-01 a 04, 08 y 12).

  Es una secuencia de trabajo dentro del mismo MVP, no un recorte.
- **Fuera del MVP del front**: admin de calidad, operación, y las HU `Post` de ambos roles. Fuentes: `CLAUDE.md`, `docs/context.md`, `docs/user-stories-auditor-supervisor.md`, `docs/client-open-questions.md`, `.claude/rules/frontend.md` y `privacy.md`, y el material del zip "flujo" (plan de trabajo PDF del 28-09-2026, prototipos `Auditoria IA.dc.html` y `Auditoria IA v2.dc.html`, diagrama de flujo por rol en PNG, `app.css` y el design system "Modernist").
> Lo que no viene de esas fuentes va marcado **[SUPUESTO]** y está en `hipotesis.md`.

## 1. Problema

Hoy un equipo de auditores del cliente escucha llamadas a mano y solo alcanza a auditar una **muestra**. El backend de Call Audit transcribe y evalúa el 100 % de las llamadas, pero ese trabajo solo genera valor si:

- el **auditor** puede validar o corregir los hallazgos de la IA rápido y con evidencia (si revisar un caso toma lo mismo que escuchar la llamada completa, el ahorro desaparece), y
- el **supervisor** puede convertir los hallazgos confirmados en feedback a ejecutivos y controlar la calidad de la revisión humana.

El front es la etapa 6 del pipeline: revisión humana y dashboard. Hoy `frontend/` está vacío.

## 2. Objetivo de negocio

- Pasar de auditar una muestra a auditar el 100 % con **menos horas humanas por cada 1.000 llamadas** (plan de trabajo).
- Que el piloto con BancoEstado Corredores de Seguros (retención de seguros) sea **medible y vendible**: ingreso potencial 10–15 MM CLP/mes.
- Que las correcciones humanas queden **estructuradas** (motivo de corrección de lista cerrada), porque son el dato que ajusta prompts y umbrales y entrena la capa 3.
- Proteger la regla no negociable: **la IA genera hallazgos; una persona decide las consecuencias**.

## 3. Métricas de éxito (KPIs)

| KPI | Meta | Fuente |
|---|---|---|
| Falsos positivos de la IA vs humanos | ≤ 5 % | Plan / context.md |
| Falsos negativos de la IA vs humanos | ≤ 20 % | Plan / context.md |
| Cobertura de llamadas del lote | 100 % | Plan |
| Resultados disponibles desde que llega el lote | < 24 h | Plan |
| Horas de auditoría humana por 1.000 llamadas | Menor que hoy (línea base `TBD`) | Plan |
| **UX** · Tiempo medio de revisión por caso | `TBD` (línea base: tiempo actual de escuchar y auditar una llamada) **[SUPUESTO: meta < 50 % de la duración de la llamada]** | Propuesta |
| **UX** · Casos revisados por auditor por hora | `TBD` (pregunta abierta #23) | HU-AUD-04 |
| **UX** · % de correcciones con motivo válido (no "Otro") | ≥ 90 % **[SUPUESTO]** | Propuesta |
| **UX** · Tasa de éxito en tareas del test de usabilidad (CUJ) | ≥ 90 % **[SUPUESTO]** | Propuesta |
| **UX** · SUS de auditores y supervisores | ≥ 75 **[SUPUESTO]** | Propuesta |
| **UX** · Llamadas con hallazgo crítico confirmado gestionadas por el supervisor el mismo día | `TBD` | HU-SUP-05 |

## 4. Alcance

### Qué sí (propuesta para el MVP del front, a confirmar en la pregunta 1)

Todas las historias marcadas `MVP` en `docs/user-stories-auditor-supervisor.md`:

- **Auditor**: cola de casos (HU-AUD-01), detalle de llamada con audio + transcripción + checklist (HU-AUD-02), confirmar/corregir con motivo cerrado (HU-AUD-03), atajos de teclado y flujo continuo con "Fin de jornada" (HU-AUD-04), escalar (HU-AUD-05), mis revisiones (HU-AUD-06), muestra de "cumple" (HU-AUD-07).
- **Supervisor**: dashboard (HU-SUP-01), motivos de no calidad (HU-SUP-02), ejecutivos y ficha (HU-SUP-03), feedback (HU-SUP-04), alertas (HU-SUP-05), revisiones de auditores (HU-SUP-06), aprobar/reabrir/cambiar (HU-SUP-07), desempeño de auditores (HU-SUP-08), exportación (HU-SUP-12).
- **Transversal**: login y permisos por rol, enmascarado de PII, banner de "hallazgos pendientes de revisión humana", trazabilidad de versiones visible.

### Qué no (por ahora)

- `Post`: mi desempeño (HU-AUD-08), calibración (HU-SUP-09), asignación de cola (HU-SUP-10), precisión IA vs auditores (HU-SUP-11), envío a sistema QA (#24), notificación por correo.
- **Admin de calidad** (editor de rúbrica, prueba en lote, publicar versión) y **Operación Qubico** (lotes, drift, trazabilidad): están en el prototipo y en el diagrama de flujo, pero no tienen historias de usuario ni prioridad. **Propuesta:** fuera del MVP del front; la rúbrica se edita como YAML versionado en el repo (regla 2) y la operación se mira en CloudWatch/Langfuse. Se decide en la pregunta 1.
- Multi-cliente (fase 3 del plan).
- App móvil. Cualquier funcionalidad que aplique sanciones (prohibido por regla 5).

## 5. Restricciones

**Técnicas**
- Next.js + React + TypeScript estricto; identificadores en inglés, textos de UI en español (`.claude/rules/frontend.md`).
- Backend FastAPI aún sin API de lectura (`src/call_audit/` vacío): el front se diseña contra el **contrato común** de capas y las entidades del plan (Lote, Llamada, Transcripción, ResultadoCapa, Decisión, Revisión). Los contratos de la API del front están por definir.
- Equipo: un desarrollador backend-first (Johannes) con Claude Code. Los componentes deben salir de una librería accesible existente, no hechos a mano **[SUPUESTO: elegir en Fase 5/8 entre opciones como Radix/shadcn o React Aria]**.
- Audio estéreo, un canal por hablante (prototipo v2); transcripción por canal con timestamps.

**De dominio y del cliente**
- Pauta de BancoEstado: **33 motivos en 5 bloques, sin puntaje ni pesos**. El prototipo usa protocolos genéricos con pesos y nota sobre 100: para BancoEstado no aplica.
- Gravedad y motivos críticos `TBD` (#1): la cola ordena por "tiene no cumple" > dudosa > muestra cumple, y luego antigüedad.
- Lista de motivos de corrección (#21), % de muestreo de "cumple" (#23, propuesta 5 %), aprobación del supervisor sobre todo o muestra (#22): abiertos.

**De privacidad y regla de negocio**
- PII enmascarada por defecto en todas las vistas, **incluida la transcripción** (el prototipo la muestra en claro en algunos textos; hay que corregirlo).
- Lenguaje: "hallazgo", "incumplimiento detectado", "pendiente de revisión"; nunca "sanción" ni "falta".

## 6. Plazos

- Plan de trabajo: inicio 05-10-2026, ~12 semanas. **MVP técnico (semanas 3–6, ~19-10 a ~13-11)** incluye "UI mínima de revisión: transcripción, evidencia y botón para corregir". **Piloto (semanas 7–10, ~16-11 a ~11-12)** incluye dashboard por agente, protocolo y día.
- Hoy (13-10) estamos en la semana 2. Implicancia: el diseño del **flujo del auditor** (CUJ-1) es lo que bloquea primero; el del supervisor puede ir una o dos semanas detrás.

## 7. Plataforma

- **Web de escritorio**, uso intensivo con teclado y audífonos (auditor) **[SUPUESTO: pantalla ≥ 1366 × 768, navegador corporativo Chrome/Edge]**.
- Responsive: el detalle de llamada y la cola se diseñan para escritorio; dashboard y alertas del supervisor deben poder leerse en tablet/notebook pequeño **[SUPUESTO]**. Sin app móvil.

## 8. Stakeholders y quién decide

| Persona / grupo | Rol | Qué decide o aporta |
|---|---|---|
| Johannes Rothkegel (Qubico) | Lead developer, implementa el front | Restricciones técnicas, aprueba gates **[SUPUESTO]** |
| Agustín Desmadryl (Qubico) | Producto y presentación; el plan le asigna "UI de revisión y dashboard (por confirmar)" | Posible dueño del diseño; ¿co-aprueba? |
| Jean Paul de Dompierre (Qubico) | Comercial | Relación con el cliente, condiciones legales (NDA, DPA), acceso a auditores |
| BancoEstado Corredores de Seguros | Cliente, dueño de la pauta | Pauta, gravedades, motivos de corrección, aprobación del piloto |
| Auditores del cliente (o del contact center) | Usuarios primarios | Validación en entrevistas y tests |
| Supervisores del contact center | Usuarios secundarios | Validación de dashboard, alertas y feedback |
| Ejecutivos del contact center | **Afectados, no usuarios** | Su desempeño se evalúa; no ven la app **[SUPUESTO]** |

## 9. Mercado y jurisdicción

- **Chile**. Cliente del sector financiero/seguros (corredora filial de un banco estatal), supervisado por la CMF.
- Proveedores en la nube posiblemente fuera de Chile (AssemblyAI, Anthropic): transferencia internacional de datos, pendiente #6.
- Sin usuarios en la UE ni otros mercados: GDPR no aplica **[SUPUESTO]**.
- Marco relevante: Ley 19.628 y su reforma Ley 21.719 (vigencia plena 01-12-2026 según el plan; verificar), Código del Trabajo (control de trabajadores), Ley 20.422 (accesibilidad), Ley 17.336 (PI), Ley 21.663 (ciberseguridad) y normativa CMF de externalización. Detalle en `registro-legal.md`.

## 10. Qué aporta el material del zip y qué falta

| Material | Qué resuelve | Brechas o divergencias detectadas |
|---|---|---|
| Diagrama de flujo por rol (PNG) | Login → rol → 4 carriles: auditor (cola → detalle → ¿IA acertó? → confirmar/corregir → ¿quedan casos? → fin de jornada), supervisor (dashboard → vista por agente → detalle → feedback / gestionada; alerta crítica con enlace directo; exportar), admin (protocolos → editor → prueba en lote → ¿mejora FP/FN? → publicar → historial), operación (lotes → drift → trazabilidad) | No incluye escalamiento, mis revisiones, control del supervisor sobre auditores (sí en HU y en el prototipo v2) |
| Prototipo v1 | Cola, detalle con veredicto/confianza/puntaje, fin de jornada | Usa puntaje y "agente/protocolo/campaña" genéricos |
| Prototipo v2 | Cubre casi todas las HU MVP: cola con filtros y "Tomar siguiente", detalle con checklist por bloque, cita no validada, panel de capas y regla aplicada, veredicto en vivo, escalar, mis revisiones con decisión lado a lado, dashboard con "según IA" vs "confirmado", alertas, revisiones de auditores, ejecutivos y ficha con feedback, motivos con heatmap, exportación con PII opcional, admin y operación | Protocolos ficticios con **pesos y puntaje sobre 100** (no aplica a BancoEstado); login con selector de rol (solo prototipo); PII en claro en parte de la transcripción; no hay estados de carga ni error de sistema; navegación sin definir para casos `in_review` bloqueados |
| `app.css` | Modernist **retuneado**: acento teal `#0f766e`, superficies blancas, radios 6–12 px, rampas de danger/warn | Contradice el Modernist original (acento rojo, radio 0, reglas de 2 px). Hay que elegir base visual (pregunta 2) |
| Design system Modernist | Tokens, componentes base (btn, tag, field, card, nav, table, dialog), Lucide, estados de foco | Rojo como único acento choca con la semántica "no cumple"; el par acento/fondo solo llega a 3:1 (no sirve para texto) |
| Plan de trabajo (PDF) | Visión, métricas, fases, entidades, equipo, riesgos | Usa veredictos en español (`cumple/no_cumple/dudosa`); el código usa `compliant/non_compliant/uncertain`: el glosario de UX debe mapearlos |

## 11. Propuesta de proceso (lo decide el usuario)

Como ya existen historias de usuario, flujos por rol y un prototipo navegable, propongo un **proceso completo pero acelerado**, reusando lo existente en vez de rehacerlo:

- **Fase 1**: proto-personas y CUJ derivados de las HU (sin entrevistas, salvo que haya acceso a auditores), benchmark corto de herramientas de QA de contact center, journey actual del auditor.
- **Fases 2–4**: convergencia rápida; el prototipo v2 se usa como "solución candidata" y se audita contra dolencias y CUJ (pasos de más, cuellos de botella, PII).
- **Fases 5–7**: patrones, microcopy y wireframes de los CUJ, con test de usabilidad con 3–5 auditores si el cliente los presta.
- **Fase 8**: tokens y componentes alineados con el código, solo después de aprobar lo anterior.
