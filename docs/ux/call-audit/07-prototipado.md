# Fase 7 · Prototipado · Front de Call Audit

> Estado: **entregada para aprobación** (2026-10-15). Incluye 7a (wireframes), 7b (prototipo navegable) y 7c (evaluación heurística propia y plan de test).
> **Contenido 100 % sintético** (L-19): llamadas, ejecutivos, auditores, seguros y transcripciones son ficticios. Los nombres de los motivos son los de la pauta del cliente (`docs/layer2-prompt-example.md`), que es configuración de dominio y no PII.
> El test con usuarios **no se ha ejecutado**: no hay acceso a usuarios reales (D-16) y se decidió **no hacerlo por ahora** (D-21, 2026-10-16). El plan queda documentado para más adelante. La lista de cambios de la sección 5 sale de la evaluación heurística; se completa con los resultados del test.

---

## 7a · Wireframes y 7b · Prototipo navegable

**Archivo:** `docs/ux/call-audit/07-prototipo-wireframes.html`. Es un solo archivo: se abre con doble clic en Chrome o Edge y no necesita servidor ni internet.

### Cómo usarlo

- **Barra negra superior (no es parte del diseño):**
  - **Pantalla**: salta a cualquier vista de los dos roles.
  - **Estado**: Normal / Vacío / Cargando / Error. En el detalle de llamada, "Vacío" simula "audio no disponible".
  - **Ocultar/Mostrar anotaciones**: los círculos negros numerados remiten al panel amarillo, que trae el comportamiento y los IDs de requisitos (`P/O/R/L`, HU, D, H).
- **Login:** "Ingresar como auditora" o "Ingresar como supervisor". Los dos botones existen solo en el prototipo; en el producto, el rol viene de la cuenta.
- **Atajos en el detalle del auditor:**
  - `Espacio` reproduce o pausa; `←/→` mueve ±5 s;
  - `J/K` pasa al hallazgo anterior o siguiente;
  - `C` confirma; `X` corrige; `E` escala;
  - `Enter` guarda y pasa al siguiente;
  - `?` abre la ayuda;
  - `Esc` cierra un diálogo.
- El audio está simulado: no hay sonido; el tiempo avanza con ▶.

### Pantallas y estados cubiertos

| Pantalla | CUJ / flujo | Estados en el prototipo | Requisitos principales |
|---|---|---|---|
| Ingreso | F-00 | Normal, Error (credenciales) | D-05, D-17, L-11, L-27, WCAG 3.3.8 |
| Auditor · Cola de casos | CUJ-1, CUJ-3 · F-01, F-03 | Normal, Vacío (sin resultados; filtro de ejecutivo agotado), Cargando, Error | HU-AUD-01, D-07, D-13, O-10, O-11 |
| Auditor · Detalle de llamada | CUJ-1, CUJ-2 · F-01, F-02 | Normal, Vacío (audio no disponible), Cargando, Error; Guardar deshabilitado con dudosos; corrección en línea; agregar hallazgo; diálogo Escalar | HU-AUD-02..05, D-02, D-18, O-01..O-06, O-16 |
| Auditor · Fin de jornada | F-01 | Éxito (cola vacía) | HU-AUD-04, O-17 |
| Auditor · Mis revisiones | F-04 | Normal, Vacío, Cargando, Error | HU-AUD-06, O-20, H-39 |
| Supervisor · Inicio | — | Normal, Cargando, Error | HU-SUP-01, O-12 |
| Supervisor · Alertas | CUJ-4 · F-05 | Normal, Vacío, Cargando, Error; marcar gestionada | HU-SUP-05, O-07, O-13 |
| Supervisor · Revisiones por aprobar | CUJ-5 · F-06 | Carriles Sin señales / Con señales; selección (tope 50); diálogo de lote; aviso con Deshacer; Vacío ("Estás al día") | D-15, D-19, O-08, L-25 |
| Supervisor · Detalle (modo supervisor) | CUJ-4, CUJ-5 | Vista de diferencias IA → Auditor; Aprobar / Reabrir / Cambiar decisión | HU-SUP-06/07, O-09, L-23 |
| Supervisor · Ejecutivos y ficha | CUJ-6 · F-07 | Lista, ficha, "Según IA" aparte, panel de feedback | HU-SUP-03/04, O-14, L-21 |
| Supervisor · Motivos | — | Ranking y heatmap con números | HU-SUP-02 |
| Supervisor · Auditores (desempeño y cuentas) | CUJ-7 · F-08 | Invitar, desactivar (con confirmación), reactivar | HU-SUP-08, D-12, L-17 |
| Supervisor · Cola completa | — | Solo lectura | H-33 |
| Diálogos | F-09 y otros | Exportar (PII sin marcar), Atajos, Reabrir, Cambiar decisión | L-04, WCAG 2.1.4 |

### Fuera del prototipo (documentado en los flujos, sin pantalla)

Invitación y activación de cuenta, recuperación de contraseña, MFA, aviso de inactividad, ver PII sin enmascarar, paleta Ctrl+K, panel de capas y motor, e historial del caso. Se dibujan en la Fase 8 o antes, si el test lo pide.

---

## 7c · Evaluación heurística propia (10 heurísticas de Nielsen)

Severidad: **0** no es problema · **1** cosmético · **2** menor · **3** mayor, arreglar antes de implementar · **4** catástrofe.

| # | Heurística | Hallazgo | Dónde | Sev. | Cambio propuesto |
|---|---|---|---|---|---|
| HE-01 | **Relación con el mundo real** | **Los motivos de la pauta están redactados en negativo** ("Niega devolución de primas", "No indica número de seguro…"). Al lado de un veredicto "Cumple / No cumple", "Motivo 28 · Niega devolución de primas · **No cumple**" se puede leer como "no negó", lo contrario de lo que significa (sí negó: hay incumplimiento) | Detalle, cola, ficha del ejecutivo, motivos | **3** | Mostrar en cada ítem el resultado como **"Incumplimiento detectado" / "Sin incumplimiento" / "Dudoso" / "No aplica"**, y dejar "Cumple / No cumple / Dudosa" solo para el veredicto de la **llamada**. Requiere ajustar el glosario aprobado (ver pregunta) |
| HE-02 | Visibilidad del estado | El autoguardado (O-10) no se ve: la auditora no sabe si su avance quedó guardado | Detalle | 2 | Indicador discreto "Guardado · hace un momento" junto a la barra de acciones |
| HE-03 | Prevención de errores | `X` (corregir) preselecciona "Cumple"; en un ítem "No cumple" eso invierte el veredicto sin una elección consciente | Detalle | 2 | `X` abre el control de veredicto sin preseleccionar; el foco va a las opciones |
| HE-04 | Consistencia y estándares | `J` = anterior y `K` = siguiente (como en HU-AUD-04) es lo contrario de la convención más extendida (Gmail, vim: `J` siguiente, `K` anterior) | Detalle | 2 | `J` siguiente, `K` anterior. Las flechas ↑/↓ quedan como alternativa |
| HE-05 | Diseño minimalista | En los bloques abiertos, los motivos que cumplen se mezclan con los que piden acción; en 1366 px la columna del checklist se alarga | Detalle | 2 | Interruptor "Mostrar solo los que piden acción" (activado por defecto); los demás, con un contador "y 31 sin incumplimiento" |
| HE-06 | Diseño minimalista | "Regla aplicada" aparece en el encabezado y vuelve en el panel de capas | Detalle | 1 | Dejarla solo en el panel "Capas y motor"; en el encabezado basta la decisión del motor |
| HE-07 | Flexibilidad y eficiencia | El supervisor aprueba todas las revisiones (D-15), pero en el detalle "Aprobar y cerrar" no tiene atajo ni "siguiente" | Detalle modo supervisor | 2 | Atajo `A` y "Aprobar y siguiente con señales" |
| HE-08 | Consistencia | En "Cambiar decisión", el diálogo pide el motivo antes de que el supervisor cambie los ítems: el orden no calza con la tarea | Detalle modo supervisor | 2 | Primero se cambian los ítems en el checklist (modo edición) y el motivo se pide al guardar |
| HE-09 | Control y libertad | Confirmar un ítem no tiene un "deshacer" explícito (se puede elegir otra opción, pero no es evidente) | Detalle | 1 | Mostrar "Confirmado por ti · Cambiar" en el ítem resuelto |
| HE-10 | Reconocer antes que recordar | "Muestra cumple" y "Según IA / Confirmado" no se explican en la vista | Cola, Inicio | 1 | Tooltip con el texto de `06` §2.6 |
| HE-11 | Ayuda a diagnosticar errores | La corrección sin motivo usa la validación nativa del navegador | Detalle | 1 | Mensaje en línea con el texto de `06` §3.3 |
| HE-12 | Visibilidad del estado | Cuando la cola tiene un filtro de ejecutivo activo, la sidebar sigue mostrando el total de pendientes, no los del filtro | Cola | 1 | El contador del encabezado indica "{n} de {total} con el filtro" |
| HE-13 | Prevención de errores | En Revisiones, "Seleccionar las primeras 50" puede incluir casos de auditores distintos sin que el supervisor lo note antes del resumen | Revisiones | 1 | El resumen del lote ya lo muestra; agregar el desglose por auditor en el diálogo |
| HE-14 | Estándares (accesibilidad) | El panel de anotaciones del prototipo tapa contenido (es del prototipo, no del diseño) | Prototipo | 0 | — |

**Resumen:** 0 catástrofes · 1 mayor (HE-01) · 7 menores · 5 cosméticos.

---

## 7c · Plan de test de usabilidad

### Objetivos

1. Que una auditora revise un caso completo con la evidencia y la ficha, sin ayuda (CUJ-1).
2. Que entienda "aceptado sin cambios" y no confirme por inercia los dudosos (D-18, H-16).
3. Que escale un caso y encuentre la respuesta (CUJ-2).
4. Que el supervisor apruebe revisiones en lote sin aprobar por error casos con señales (CUJ-5, D-19).
5. Que el supervisor atienda una alerta y registre feedback con evidencia (CUJ-4, CUJ-6).
6. Validar HE-01: cómo se lee el veredicto de un motivo redactado en negativo.

### Participantes

- **Ideal:** 5 auditores y 3 supervisores del cliente. **No hay acceso (D-16).**
- **Alternativa propuesta: usuarios proxy** (H-29):
  - 5 personas con experiencia en QA, auditoría o calidad de contact center (pueden ser de la red de Qubico), más 1–2 personas sin experiencia en el dominio como control de comprensión;
  - incluir, si se puede, a 1 persona que use lector de pantalla o solo teclado.
- **Límite de la alternativa:** los proxies no conocen la pauta ni la herramienta actual. Los tiempos medidos son indicativos y los hallazgos de dominio (criterios, ficha) se validan después con el cliente.

### Formato

- Sesiones moderadas de 45 min, remotas o presenciales, con el prototipo `07-prototipo-wireframes.html` y "pensar en voz alta".
- Se graba la pantalla y el audio solo con consentimiento (sección "Consentimiento").

### Tareas

| # | Tarea (lo que se le dice al participante) | Rol | CUJ | Criterio de éxito |
|---|---|---|---|---|
| T1 | "Empieza tu jornada y revisa el primer caso que te toque." | A | CUJ-1 | Abre con Tomar siguiente, va a la evidencia del motivo 28 y lo confirma |
| T2 | "Para este caso, ¿qué dice la ficha del seguro sobre la devolución de primas?" | A | CUJ-1 | Encuentra la sección destacada sin salir del detalle |
| T3 | "Resuelve lo que falta en este caso y guárdalo." | A | CUJ-1 | Resuelve los 2 dudosos (uno con motivo de corrección) y guarda |
| T4 | "En este caso no sabes qué criterio aplicar. Pídele ayuda a tu supervisor." | A | CUJ-2 | Escala con motivo y comentario |
| T5 | "Revisa solo los casos pendientes de Camila Vera." | A | CUJ-3 | Filtra por ejecutivo y vuelve a la cola completa |
| T6 | "Aprueba las revisiones de ayer que no necesitan que las mires una a una." | S | CUJ-5 | Usa el carril Sin señales, ve el resumen y aprueba; no incluye casos con señales |
| T7 | "Hay un escalamiento nuevo. Respóndelo." | S | CUJ-4 | Abre la alerta en el minuto y reabre con un comentario |
| T8 | "Prepara la conversación con Rubén Soto y deja registrado lo que acordaron." | S | CUJ-6 | Registra feedback con al menos una llamada asociada |
| T9 | "Se incorpora una auditora nueva; dale acceso." | S | CUJ-7 | Invita con correo y forma de ingreso |
| T10 | Pregunta de comprensión: "¿Qué significa «Motivo 28 · Niega devolución de primas · No cumple»?" | A, S | HE-01 | Responde que el ejecutivo sí negó la devolución (hay incumplimiento) |

### Métricas

| Métrica | Cómo | Meta |
|---|---|---|
| Tasa de éxito por tarea | Completa / con ayuda / falla | ≥ 90 % sin ayuda en T1, T3, T6 (H-09) |
| Tiempo por tarea | Desde la consigna hasta el criterio de éxito | Indicativo (proxies); comparar entre rondas |
| Errores | Acciones erradas (ej. aprobar un caso con señales, confirmar un dudoso sin mirar la evidencia) | 0 errores críticos en T6 |
| Facilidad por tarea | SEQ (1–7) después de cada tarea | ≥ 5,5 |
| SUS | Cuestionario al final | ≥ 75 (H-09) |
| Comprensión de HE-01 | Respuesta correcta en T10 | ≥ 90 %; si es menor, se aplica el cambio propuesto en HE-01 |

### Guion del moderador (resumen)

1. **Bienvenida (3 min):** "Estamos probando la herramienta, no a ti. No hay respuestas incorrectas. Piensa en voz alta." Consentimiento.
2. **Contexto (2 min):** "Imagina que eres auditora o auditor de calidad de un contact center de retención de seguros. La IA revisa todas las llamadas y propone hallazgos; tú decides."
3. **Tareas (30 min):** se lee cada tarea tal cual; no se ayuda salvo bloqueo de más de 2 min ("¿Qué buscarías ahora?"). Después de cada tarea, SEQ.
4. **Preguntas abiertas (7 min):** "¿Qué fue lo más difícil?" · "¿En qué momento dudaste de lo que proponía la IA?" · "¿Qué esperabas que pasara al guardar?"
5. **Cierre (3 min):** SUS y agradecimiento.

### Consentimiento del participante (borrador; revisar con abogado, L-14)

> Te invitamos a probar un prototipo de Call Audit durante unos 45 minutos. **Participar es voluntario** y puedes retirarte cuando quieras. **No te estamos evaluando:** probamos la herramienta.
> Con tu autorización grabaremos **la pantalla y el audio** de la sesión, solo para el equipo de diseño de Qubico. La grabación se elimina dentro de los `TBD` días siguientes al análisis. Las citas que usemos serán anónimas.
> El prototipo usa **datos ficticios**: no verás información de clientes reales.
> Puedes pedir acceso a tus datos o su eliminación escribiendo a `TBD`.
> ☐ Acepto participar. ☐ Autorizo la grabación de pantalla y audio. *(Ambas casillas sin marcar.)*

---

## 5. Lista de cambios

### 5.1 Desde la evaluación heurística (a aplicar en la Fase 8)

| ID | Cambio | Origen | Estado |
|---|---|---|---|
| C-01 | Por motivo: **Cumple / Incumple / Dudoso**, sin "No aplica"; por llamada: Cumple / No cumple / Dudosa. Veredicto antes del nombre del motivo + línea de apoyo en positivo | HE-01 · D-20 | **Decidido (2026-10-16)**; se aplica en la Fase 8 |
| C-02 | Indicador de autoguardado | HE-02 | Propuesto |
| C-03 | `X` sin preselección | HE-03 | Propuesto |
| C-04 | `J` siguiente / `K` anterior (+ ↑/↓) | HE-04 | Propuesto (ajusta HU-AUD-04) |
| C-05 | "Mostrar solo los que piden acción" activado por defecto | HE-05 | Propuesto |
| C-06 | "Regla aplicada" solo en el panel de capas | HE-06 | Propuesto |
| C-07 | Supervisor: atajo `A` y "Aprobar y siguiente" | HE-07 | Propuesto |
| C-08 | "Cambiar decisión": editar los ítems primero y pedir el motivo al guardar | HE-08 | Propuesto |
| C-09 | "Confirmado por ti · Cambiar" en los ítems resueltos | HE-09 | Propuesto |
| C-10 | Tooltips de "Muestra cumple" y "Según IA / Confirmado" | HE-10 | Propuesto |
| C-11 | Mensajes de validación en línea | HE-11 | Propuesto |
| C-12 | Contador "{n} de {total} con el filtro" | HE-12 | Propuesto |
| C-13 | Desglose por auditor en el resumen del lote | HE-13 | Propuesto |

### 5.2 Desde el test de usabilidad

Pendiente de ejecución. Se agrega aquí con su severidad y el cambio aplicado, y se itera el prototipo antes de cerrar la Fase 8.
