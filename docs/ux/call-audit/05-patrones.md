# Fase 5 · Patrones de diseño y navegación · Front de Call Audit

> Estado: **entregada para aprobación** (2026-10-15). Base: AI aprobada (`03`), flujos aprobados (`04`), base visual `app.css` con marca Qubico (D-03), Chrome/Edge en escritorio (D-06).
> Stack del front: Next.js + React + TypeScript estricto (`.claude/rules/frontend.md`). Un dev backend-first: los patrones se eligen para salir de componentes accesibles ya hechos, no a mano.

---

## 1. Modelo de navegación

### 1.1 Decisión: sidebar fija a la izquierda + área de trabajo

| Opción | Pro | Contra | Veredicto |
|---|---|---|---|
| **Sidebar vertical** | Caben las 7 secciones del supervisor con contadores (badges); el patrón es estándar en herramientas de trabajo en escritorio; se puede colapsar a íconos para dar espacio al detalle | Ocupa ancho horizontal | **Elegida** |
| Top nav horizontal | Más ancho útil | 7 etiquetas + badges no caben bien a 1366 px; el menú de usuario compite por espacio | Descartada |
| Hub & spoke (tablero de inicio con tarjetas) | Claro para usos ocasionales | El auditor trabaja en serie todo el día: cada vuelta al hub es un paso de más | Descartada |
| Tab bar inferior | — | Es un patrón móvil; aquí no hay móvil | Descartada |

**Reglas**
- **Ancho** **[SUPUESTO]**: 232 px expandida (como el prototipo) y 64 px colapsada. Se recuerda la preferencia del usuario.
- **Contenido de la sidebar:**
  - logo Qubico;
  - nombre de la app ("Auditoría de llamadas");
  - secciones del rol (`03` §4.1) con contadores: Cola = pendientes, Mis revisiones = reabiertos, Alertas = nuevas, Revisiones = por aprobar;
  - al pie, el menú de usuario (nombre, rol, Preferencias, Atajos, Privacidad, Cerrar sesión).
- **En el detalle de llamada** la sidebar se colapsa sola a íconos para darle el ancho a las zonas de trabajo. Se puede expandir a mano.
- **El detalle no es una sección**: se abre como página propia (`/calls/[id]`), con "← Volver a {origen}" y un breadcrumb corto.
- **Encabezado de cada página**: título + subtítulo de contexto (ej. "Ordenada por gravedad y antigüedad") + acciones principales a la derecha (Tomar siguiente, Exportar).
- **Breakpoints:**
  - ≥ 1280 px: diseño completo;
  - 1024–1279 px: sidebar colapsada por defecto; en el detalle, la ficha del seguro pasa a un panel que se abre a demanda;
  - < 1024 px: no está soportado para revisar. Se muestra un aviso, salvo en las vistas de lectura del supervisor (Inicio, Alertas), que deben poder leerse **[SUPUESTO, H-10]**.

### 1.2 Layout del detalle de llamada (pantalla crítica)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Volver a Cola   LL-…  · Ejecutivo · Seguros · Decisión del motor · Estado   │
│ ⓘ Hallazgos generados por IA, pendientes de revisión humana (fijo)            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Reproductor: ▶  00:07:42 / 11:03  [forma de onda con marcas]  1x 1,25x 1,5x 2x│
├──────────────────────────────┬──────────────────────────┬────────────────────┤
│ Transcripción                │ Checklist de la pauta     │ Ficha del seguro   │
│ (Ejecutivo / Cliente / Otro) │ 5 bloques; foco en el 1º  │ Datos de la llamada│
│ turno activo resaltado,      │ no cumple o dudoso        │ Categoría · Prima  │
│ cita resaltada, buscar       │ Confirmar · Corregir      │ Devolución · Retr. │
│ scroll virtual               │ Agregar hallazgo          │ ▸ Coberturas …     │
│                              │                           │ (destaca la sección│
│                              │                           │  del motivo)       │
├──────────────────────────────┴──────────────────────────┴────────────────────┤
│ Veredicto resultante: No cumple · Te queda 1 dudoso    [Escalar E] [Guardar ↵]│
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Tres columnas redimensionables:**
  - Transcripción ~40 %, Checklist ~35 %, Ficha ~25 % **[SUPUESTO]**.
  - La ficha se puede plegar a una pestaña lateral.
  - Si la llamada trae varios seguros, la ficha tiene una pestaña por seguro.
- **Reproductor y barra de acciones fijos** (sticky): siempre visibles mientras se hace scroll.
- **Paneles secundarios** (Capas y motor, Historial del caso, Tipificación) van en pestañas bajo el checklist o en un panel desplegable, porque no son parte del recorrido principal.
- **Modo supervisor:**
  - el checklist suma la columna "IA → Auditor";
  - la barra de acciones cambia a Aprobar · Reabrir · Cambiar decisión;
  - aparece el estado de seguimiento del ejecutivo.

**Patrón de referencia**: el de "tres zonas" (audio, transcripción, formulario) que repiten los referentes del benchmark (`01` §2). Se suma la ficha del seguro como cuarta zona, que es la diferencia propia de este producto (O-03).

---

## 2. Catálogo de patrones

| Patrón | Dónde | Comportamiento | Por qué | Req. |
|---|---|---|---|---|
| **Tabla de datos** con orden por columna, filas clicables y selección (solo en Revisiones) | Cola, Mis revisiones, Revisiones, Ejecutivos, Motivos, Auditores, Cuentas | Encabezados con orden accesible (`aria-sort`); la fila completa abre el detalle; paginación por servidor; columnas fijas por vista; densidad compacta | El trabajo es comparar y elegir entre muchos casos | HU-AUD-01, HU-SUP-06 |
| **Barra de filtros + chips activos** | Cola, Revisiones, Ejecutivos, Motivos, Inicio | Filtros en línea (select, rango de fechas); cada filtro activo se muestra como chip con ✕; "Limpiar filtros"; el estado de los filtros va en la URL **sin PII** (IDs internos) | Visibilidad del filtro activo (F-03); compartir y recargar sin perder contexto | O-11, L-03 |
| **Combobox con autocompletado** | Búsqueda de ejecutivo (Cola, Ejecutivos), elegir auditor al reabrir | Patrón ARIA combobox; resultados con un dato que distingue nombres repetidos; texto auxiliar "Las búsquedas por ejecutivo quedan registradas" | Encontrar en menos de 10 s; nombres repetidos | O-11, L-18 |
| **Pestañas** | Carriles de Revisiones ("Sin señales" / "Con señales"), Auditores (Desempeño / Cuentas), seguros en la ficha, paneles secundarios del detalle | Patrón ARIA tabs; el contador va en la etiqueta | Separar sin cambiar de página | O-08 |
| **Reproductor de audio con forma de onda y marcas** | Detalle | Teclado completo; marcas clicables con su motivo como etiqueta accesible; velocidad persistente por usuario | Ir a la evidencia | O-01 |
| **Lista virtualizada sincronizada** | Transcripción | Renderiza solo lo visible (llamadas de hasta 314 turnos); sigue el audio salvo que el usuario haga scroll (botón "Volver al audio"); búsqueda dentro del texto | Rendimiento y foco | H-12, O-01 |
| **Acordeón** | Bloques del checklist; secciones de la ficha del seguro | Bloques con contador ("2 no cumple · 1 dudoso"); al abrir el caso, solo se expanden los bloques con hallazgos que piden acción | Densidad: 33 motivos | O-02, O-03 |
| **Control segmentado** | Veredicto de un motivo (Confirmar · Cumple · Incumple; sin "No aplica", D-20); velocidad del audio; formato de exportación | Grupo de radios accesible; la opción elegida se nota por forma y texto, no solo por color | Elección única y rápida | HU-AUD-03 |
| **Formulario en línea** | Corrección (motivo + comentario), agregar hallazgo | Se despliega dentro del ítem, sin modal; el foco va al primer campo; Enter confirma, Esc cancela | No perder el contexto de la evidencia | O-04 |
| **Diálogo modal** | Escalar, Reabrir, Cambiar decisión (resumen), Aprobar en lote, Invitar auditor, Desactivar cuenta, Exportar, Ver PII, Ayuda de atajos | Foco atrapado; Esc cierra; el botón principal describe la acción ("Escalar caso", "Aprobar 50 revisiones"); el de destrucción va separado | Acciones con consecuencias o que piden datos | F-02, F-05, F-06, F-08, F-09 |
| **Panel lateral (drawer)** | Registrar feedback; ficha del seguro en pantallas de 1024–1279 px | Se abre a la derecha sin perder la vista de fondo | Contexto + formulario | F-07 |
| **Aviso temporal (toast) con Deshacer** | Aprobación en lote (10 s), caso guardado, invitación enviada | Región `aria-live="polite"`; no tapa la barra de acciones; nunca es el único lugar donde se informa un error | Feedback sin interrumpir | F-06, H-38 |
| **Banner persistente** | "Hallazgos generados por IA…"; cuenta en solo lectura; caso bloqueado por otra persona; audio no disponible | No se puede cerrar cuando es legal o de estado | Transparencia | L-07 |
| **Estados vacíos** | Cola vacía (= Fin de jornada), sin alertas, nada por aprobar, sin resultados de filtro, sin revisiones | Qué significa + qué hacer ahora (una acción) | Sin callejones sin salida | F-01, F-04, F-05, F-06 |
| **Carga** | Tablas y detalle | Esqueletos (skeleton) con la forma final; el audio carga aparte de la transcripción, y se puede empezar a leer antes de que cargue el audio | Percepción de velocidad | — |
| **Errores** | Red, guardar, permisos, audio | Qué pasó + cómo seguir; se conserva lo ingresado; Reintentar | Recuperación | F-01 |
| **Validación de formularios** | Corrección, feedback, invitación, escalar | Al enviar y al salir del campo; mensaje junto al campo; resumen arriba si hay varios errores | WCAG 3.3.1/3.3.3 | F-07, F-08 |
| **Atajos de teclado + paleta de comandos (Ctrl+K)** | Detalle (auditor y supervisor), Revisiones | Atajos de HU-AUD-04; "?" abre la ayuda; atajos de una sola tecla desactivables en Preferencias; no se activan mientras se escribe; Ctrl+K para acciones poco frecuentes (ir a sección, buscar llamada por ID) | Velocidad (D-15) y WCAG 2.1.4 | O-05 |
| **Contadores (badges)** | Sidebar y pestañas | Número + texto accesible ("3 alertas nuevas") | Saber qué espera acción | O-13 |
| **Etiquetas de estado (tags)** | Veredictos, estados del caso, "Muestra cumple", "Según IA" / "Confirmado", "Aprobado en lote" | Ícono + texto + color; nunca solo color | WCAG 1.4.1 | O-12 |
| **Tarjetas KPI + gráficos simples** | Inicio, ficha del ejecutivo, desempeño de auditores | Valor + etiqueta de la fuente (Según IA / Confirmado) + enlace a la lista; gráficos de línea y barra con la tabla de datos accesible como alternativa | Leer en un vistazo; accesibilidad | HU-SUP-01, O-12 |
| **Heatmap** | Motivo × ejecutivo | Valor numérico en cada celda; escala secuencial de un solo tono; "—" cuando el ejecutivo no atiende ese seguro | Comparar sin depender del color | HU-SUP-02 |
| **Paginación** | Tablas | Paginación numerada con tamaño de página (25/50/100); en Revisiones, la selección de lote se limita a 50 | Volumen alto; tope del lote | D-19 |
| **Onboarding** | Primer ingreso | Sin tour largo: una tarjeta de bienvenida descartable con los 3 atajos clave y un enlace a "?" **[SUPUESTO]** | Herramienta de uso diario; el tour estorba | — |
| **Confirmaciones** | Solo en acciones con consecuencia: aprobar en lote, desactivar cuenta, cambiar una decisión, exportar con PII | Guardar un caso **no** pide confirmación (es reversible mientras no se apruebe) | Evitar diálogos de más | F-01, F-06 |
| **Bloqueo de concurrencia** | Caso `in_review` | Banner "Lo está revisando {nombre}"; solo lectura; en la Cola, ícono de candado + texto | P-13 | O-10 |

### 2.1 Guías de plataforma

- Web de escritorio. Como referencia de componentes se usan los **patrones ARIA del W3C (WAI-ARIA Authoring Practices)**: combobox, tabs, dialog, grid/table, disclosure, toolbar.
- Material Design o Apple HIG **no aplican** como sistema visual (la base es Modernist/app.css, D-03). Sí se toman de Material dos criterios: densidad de tablas y tamaño de objetivos.

### 2.2 Librería de componentes recomendada **[SUPUESTO técnico: lo decide Johannes]**

| Necesidad | Recomendación | Por qué |
|---|---|---|
| Primitivas accesibles (dialog, tabs, combobox, popover, tooltip, toast) | **shadcn/ui** sobre **Radix UI**, con Tailwind | Componentes accesibles que se copian al repo (son código propio, no una caja negra); se tematizan con variables CSS, que calzan con los tokens de `app.css` |
| Tablas | **TanStack Table** | Orden, filtros, selección y paginación sin imponer estilos |
| Transcripción larga | **TanStack Virtual** | Virtualización de listas |
| Forma de onda y marcas | **wavesurfer.js** (plugin de regiones o marcadores) | Patrón de onda + regiones estándar |
| Paleta de comandos | **cmdk** (la usa shadcn/ui) | Ctrl+K accesible |
| Gráficos | **Recharts** o similar | Línea, barra y heatmap simples |
| Íconos | **Lucide** (licencia ISC; el DS Modernist ya los usa) | Coherencia con el DS; licencia libre (L-13) |

> Las versiones se fijan al implementar, verificando las vigentes (CLAUDE.md: no citar versiones de memoria).

---

## 3. Anti-patrones prohibidos

### 3.1 Dark patterns (Registro Legal)

| Anti-patrón | Cómo se evita aquí |
|---|---|
| **Casillas premarcadas** | "Incluir datos personales", aceptar términos e invitaciones: siempre sin marcar |
| **Confirmshaming** | Nada de "No, prefiero hacerlo mal". Los botones secundarios dicen "Cancelar" o el nombre de la acción |
| **Pregunta engañosa** | Los botones dicen la acción concreta ("Aprobar 50 revisiones", "Desactivar cuenta"), nunca "Aceptar" o "Sí" a secas |
| **Forzar registro innecesario** | No hay auto-registro; tampoco se piden datos que no se usan (minimización) |
| **Urgencia o escasez falsa** | Los contadores son reales; no hay temporizadores de presión (salvo el aviso real de cierre de sesión) |
| **Roach motel** | Desactivar una cuenta toma lo mismo que crearla. Rechazar cookies, si algún día hay banner, debe ser igual de fácil que aceptarlas |
| **Publicidad disfrazada** | No aplica (sin publicidad) |
| **Costos ocultos** | No aplica (sin transacciones) |

### 3.2 Anti-patrones del dominio

| Anti-patrón | Por qué está prohibido | Ref. |
|---|---|---|
| Mostrar un "puntaje" o nota por llamada o ejecutivo | La pauta de BancoEstado no tiene puntaje | Brief §5 |
| Rankings "de peor a mejor" de ejecutivos o auditores por defecto | Control laboral | L-06, L-22 |
| Palabras "sanción", "falta", "infracción", "castigo" | Regla 5, lenguaje no sancionatorio | L-15 |
| Mezclar "según IA" y "confirmado" en un mismo número | Decisiones solo automatizadas | L-07 |
| Botón "Confirmar todo" en casos con ítems dudosos | Sesgo de automatización | HU-AUD-03, H-16 |
| Aprobar en lote casos con señales | Revisión humana real | L-25 |
| PII en URLs, títulos de pestaña, toasts o mensajes de error | Privacidad | L-03 |
| Borrar cuentas o revisiones | Trazabilidad | L-17, regla 3 |
| Semáforo rojo/verde como único indicador | Accesibilidad | WCAG 1.4.1 |

**Ojo con el color de acento:** en `app.css` el acento es teal, y el prototipo pinta "cumple" con el tono del acento. Hay que evitar que el color de las acciones principales (botones) se confunda con el de "cumple". Se resuelve en la Fase 8 con tokens semánticos separados: `--color-action-*` y `--color-verdict-*`.

---

## 4. Criterios de accesibilidad (WCAG 2.2 AA mínimo)

| Criterio | Aplicación concreta | WCAG |
|---|---|---|
| **Contraste** | Texto ≥ 4.5:1; texto grande, íconos y bordes de controles ≥ 3:1. El acento de `app.css` (#0f766e sobre blanco) se valida en la Fase 8; las etiquetas de veredicto usan los tonos 700–800 sobre fondos 100 | 1.4.3, 1.4.11 |
| **No depender del color** | Veredictos y estados con ícono + texto; marcas de la forma de onda con forma distinta por veredicto; el heatmap muestra los números | 1.4.1 |
| **Teclado completo** | Todo operable con teclado; orden de foco: reproductor → transcripción → checklist → ficha → acciones; foco visible de 2 px con el acento (app.css) y sin que lo tapen elementos fijos | 2.1.1, 2.4.3, 2.4.7, **2.4.11** |
| **Atajos de una sola tecla** | Desactivables en Preferencias; solo activos con el foco en el detalle y nunca en campos de texto | 2.1.4 |
| **Objetivos** | Mínimo 24 × 24 px (los controles principales, 32–40 px); las marcas de la forma de onda tienen un área de clic mayor que el punto visible | **2.5.8** |
| **Arrastrar** | Redimensionar las columnas tiene una alternativa sin arrastrar (preajustes o teclado) | **2.5.7** |
| **Etiquetas y nombres** | Todo control con etiqueta visible; los botones de solo ícono tienen nombre accesible; el nombre accesible incluye el texto visible | 1.3.1, 2.5.3, 4.1.2 |
| **Mensajes de estado** | Toasts, "caso guardado", contadores y veredicto en vivo se anuncian por `aria-live` | 4.1.3 |
| **Errores** | Se identifican junto al campo, con sugerencia de solución; no se pierde lo ingresado | 3.3.1, 3.3.3 |
| **Autenticación** | Login sin pruebas cognitivas; se permite pegar contraseñas y usar el gestor de contraseñas; el MFA acepta códigos pegados | **3.3.8** |
| **Ayuda consistente** | "?" (atajos) y la ayuda están siempre en el mismo lugar (menú de usuario) | **3.2.6** |
| **Entrada redundante** | No se pide de nuevo lo que el sistema ya sabe (minuto, hallazgo, llamadas asociadas al feedback) | **3.3.7** |
| **Tiempo** | Aviso antes de cerrar la sesión, con opción de extenderla; sin pérdida de datos | 2.2.1 |
| **Audio** | La transcripción es la alternativa textual; nada se reproduce solo al abrir el caso (el audio queda posicionado, en pausa) | 1.2.1, 1.4.2 |
| **Zoom y reflujo** | Usable al 200 % de zoom en 1280 px (la ficha pasa a un drawer); sin scroll horizontal en las vistas de lectura | 1.4.4, 1.4.10 |
| **Movimiento** | Respetar `prefers-reduced-motion` (desplazamiento automático de la transcripción sin animación) | 2.3.3 (buena práctica) |
| **Idioma** | `lang="es-CL"` | 3.1.1 |

> En negrita, los criterios nuevos de WCAG 2.2 que suelen omitirse.

---

## 5. Supuestos de esta fase

| ID | Supuesto |
|---|---|
| H-40 | Sidebar de 232/64 px; el detalle la colapsa sola |
| H-41 | Columnas del detalle ~40/35/25 %, redimensionables |
| H-42 | La librería de componentes es shadcn/ui + Radix + Tailwind, con TanStack Table/Virtual, wavesurfer.js, cmdk y Lucide (decisión técnica de Johannes) |
| H-43 | Onboarding mínimo: tarjeta de bienvenida descartable, sin tour |
| H-10 | Las vistas de lectura del supervisor (Inicio, Alertas) se pueden leer bajo 1024 px; la revisión no |
