# Fase 8 · Alta fidelidad y handoff · Front de Call Audit

> Estado: **entregada para aprobación** (2026-10-16). Base: fases 0–7 aprobadas, decisiones D-01 a D-21, cambios C-01 a C-13.
> Entregables visuales en HTML (sin Figma): se abren con doble clic en Chrome o Edge. Contenido 100 % sintético.

## Entregables

| Archivo | Qué es |
|---|---|
| `08-prototipo-alta-fidelidad.html` | **Prototipo navegable de alta fidelidad** de los dos roles y todos los CUJ, con C-01 a C-13 aplicados. La barra negra superior es del prototipo: pantalla, estado (normal / vacío / cargando / error) y "Mostrar notas de handoff" (componente, tokens y requisito de cada zona) |
| `08-design-system.html` | **Design system**: paleta, contraste validado, tipografía, espaciado, radios, sombras, marca, y cada componente con sus variantes y estados |
| `08-tokens.css` | **Tokens (fuente de verdad)**: variables CSS con nombres semánticos de shadcn/ui + tokens del dominio |
| `08-tokens.json` | Los mismos tokens en formato W3C Design Tokens (DTCG), para herramientas |
| `07-prototipo-wireframes.html` | Wireframes de la Fase 7 (referencia; reemplazados por el de alta fidelidad) |

---

## 1. Fundamentos

### 1.1 Decisiones de color

- **Teal (`--primary` #0f766e) = acción, foco y navegación activa.** Nunca representa un veredicto.
- **Veredictos con su propia familia** (resuelve el riesgo de `05` §3.2):
  - Incumple: rojo sólido;
  - No cumple (llamada): rojo suave en píldora;
  - Dudoso / Dudosa: ámbar con borde punteado;
  - Cumple: **neutro**, discreto a propósito, porque es lo normal y no debe competir por atención.
- **Fuente del dato:**
  - "Según IA": contorno punteado;
  - "Confirmado": sólido tinta (`--ink-900`, el negro de la marca).
- Solo modo claro en el MVP **[SUPUESTO]** (H-51).

### 1.2 Contraste (calculado, WCAG 2.2)

| Par | Contraste | Mínimo | |
|---|---|---|---|
| Texto principal / fondo | 15,41:1 | 4,5 | ✓ |
| Texto secundario (neutral-700) / blanco · / fondo | 6,85 · 6,38 | 4,5 | ✓ |
| Texto terciario (neutral-600) / blanco | 4,59 | 4,5 | ✓ |
| Texto terciario / fondo `#f5f7f8` | 4,27 | 4,5 | ✕ **no usar** |
| Blanco / botón primario · / hover | 5,47 · 8,18 | 4,5 | ✓ |
| Texto activo (teal-800) / `--accent` | 9,21 | 4,5 | ✓ |
| Anillo de foco teal-600 / blanco | 5,47 | 3 | ✓ |
| Blanco / Incumple (red-700) | 6,64 | 4,5 | ✓ |
| No cumple (red-700) / red-100 | 5,89 | 4,5 | ✓ |
| Dudoso (amber-800) / amber-100 | 7,57 | 4,5 | ✓ |
| Borde Dudoso (amber-600) / blanco | 3,05 | 3 | ✓ |
| Cumple (neutral-800) / neutral-100 | 9,57 | 4,5 | ✓ |
| Borde de controles (neutral-500) / blanco | 3,15 | 3 | ✓ |
| Divisor (neutral-200) / blanco | 1,25 | — | decorativo (no delimita controles) |

> El `#e2e6ea` de `app.css` no sirve como borde de inputs (1,25:1). Los controles usan `--input` (#8a929c).

### 1.3 Tipografía

**Archivo** (Google Fonts, SIL OFL), pesos 400/500/600/700. Escala:
- 12/16: encabezados de tabla, badges;
- 13/18: etiquetas;
- **14/20: base**;
- 15/22: transcripción;
- 18/24: títulos de diálogo;
- 22/28: título de página;
- 28/34: KPI.

Las cifras van tabulares (`tabular-nums`).

### 1.4 Espaciado, radios, sombras, grilla y breakpoints

- **Espaciado** con base 4: 4, 8, 12, 16, 20, 24, 32 y 40.
- **Radios:**
  - 4: etiquetas;
  - 6: botones e inputs;
  - 8: cards;
  - 12: diálogos;
  - full: badges y chips.
- **Sombras:** sm para cards, md para la barra de acciones, lg para diálogos, drawer y toast.
- **Grilla:** sidebar 232/64 px y gutter de 24 px.
- **Breakpoints:**
  - **1024**: sidebar colapsada; la ficha del seguro pasa a un drawer con el botón "Ficha del seguro";
  - **1280**: layout completo en 3 columnas;
  - **1536**.
- **Objetivos:** mínimo de 24 px; controles de 32 px; el login y la acción principal, de 40 px.

### 1.5 Marca

- El logo Qubico (PNG negro del usuario) es la referencia.
- En los HTML va una **aproximación vectorial provisional** del símbolo (cubo con nodos) más el logotipo compuesto en Archivo 700 con tracking 0,14 em, en versión normal e invertida.
- **Hay que reemplazarla por el SVG oficial** (H-28).
- No se copió el PNG al repo.

### 1.6 Resultado por motivo (D-20) y la lectura invertida (HE-01)

- **Por motivo: Cumple / Incumple / Dudoso.** No hay "No aplica": `not_applicable` del contrato **se muestra como Cumple**.
- **Por llamada: Cumple / No cumple / Dudosa.** Se mantiene distinto a propósito: son dos niveles y la decisión de la llamada la toma el motor.
- **Cómo se resolvió HE-01** sin reescribir los motivos de la pauta (en `FindingItem`):
  1. el badge del veredicto va **antes** del nombre del motivo;
  2. una **línea de apoyo en positivo**: "Se detectó en la llamada · 07:50" / "No se detectó en la llamada" / "No está claro si ocurrió · revisa la evidencia";
  3. el encabezado "Pauta de calidad · motivos de no calidad" lleva un tooltip: "Cada motivo describe algo que no debe ocurrir. Incumple = ocurrió".
- Se valida con la tarea T10 cuando haya test (H-49).

---

## 2. Componentes (nombres alineados al código)

Base: **shadcn/ui + Radix** (H-42). Componentes propios del dominio en `frontend/src/components/`. **[SUPUESTO: estructura de carpetas a definir al iniciar el front]**

| Componente | Base shadcn / librería | Variantes y estados | Props clave | Dónde |
|---|---|---|---|---|
| `Button` | Button | default (primario), secondary, ghost, destructive · sm/default/lg · hover, focus, disabled, loading | `variant`, `size`, `shortcut?` (renderiza `Kbd` aparte) | Todo |
| `Kbd` | — | default, sobre primario | `keys` | Botones, ayuda de atajos |
| `Input`, `Select`, `Checkbox`, `Textarea` | Input, Select, Checkbox, Textarea | default, focus, error (`aria-invalid`), disabled | `error?` + `FormMessage` | Formularios |
| `EmployeeCombobox` | Command (cmdk) + Popover | vacío, resultados, nombres repetidos, sin resultados | `onSelect(agentId)`, aviso de registro | Cola, Ejecutivos |
| `FilterBar`, `FilterChip` | — | chip activo con quitar | `filters`, `onClear` | Cola, Revisiones, Ejecutivos, Motivos, Inicio |
| `DataTable` | TanStack Table + Table | orden (`aria-sort`), fila clicable, selección (Revisiones), paginación, vacío, cargando, error | `columns`, `rowHref`, `selectable`, `maxSelection=50` | Listas |
| `ItemVerdictBadge` | Badge | `compliant` · `non_compliant` · `uncertain` (`not_applicable` → Cumple) | `verdict` | Pauta, ficha del ejecutivo |
| `CallVerdictBadge` | Badge | `compliant` · `non_compliant` · `uncertain` | `verdict` | Cola, encabezado, Mis revisiones, Revisiones |
| `SourceBadge` | Badge | `ai` · `human` | `source` | KPIs, ficha del ejecutivo |
| `StatusBadge` | Badge | estados del caso (`03` §4.3), Crítico, Muestra cumple, Bloqueado | `status` | Listas, detalle |
| `SidebarNav`, `NavItem` | — | default, hover, activo, badge (trabajo / alerta), colapsado | `items`, `collapsed` | Shell |
| `AudioPlayer` | wavesurfer.js (regiones/marcadores) | reproduciendo, pausa, audio no disponible, cargando | `src`, `markers[]`, `onSeek`, `rate` | Detalle |
| `FindingMarker` | — | `non_compliant` (cuadrado), `uncertain` (círculo punteado), en foco | `findingId`, `startMs` | Reproductor |
| `Transcript`, `TranscriptTurn` | TanStack Virtual | default, activo, cita resaltada, mal transcrito | `turns[]`, `currentMs`, `highlight` | Detalle |
| `RubricChecklist`, `RubricBlock` | Accordion | abierto/cerrado, contadores, "Solo los que piden acción" | `blocks[]`, `onlyActionable` | Detalle |
| `FindingItem` | — | en foco, Incumple, Dudoso (comentario plegado), cita no validada, Cumple sin acción, resuelto con "Cambiar", corrección en línea (error), modo supervisor (diferencias / edición) | `finding`, `mode: auditor\|supervisor\|readonly` | Detalle |
| `CorrectionForm` | Form + Select + Textarea | sin motivo (error), "Otro" con comentario obligatorio | `reasons[]` (lista cerrada, #21) | `FindingItem` |
| `ProductSheet` | Tabs + Collapsible | sección relevante destacada, sin dato, sin ficha; drawer bajo 1280 px | `products[]`, `relevantSection` | Detalle |
| `ActionBar` | — | auditor (Escalar, Guardar y siguiente, autoguardado), supervisor (Reabrir, Cambiar, Aprobar y siguiente / modo edición) | `mode`, `pendingCount`, `savedAt` | Detalle |
| `AiBanner` | Alert | fijo, sin cerrar | — | Detalle |
| `KpiCard` | Card | con fuente, clicable | `value`, `label`, `source`, `href` | Inicio, fichas |
| `ReviewLanes` | Tabs | Sin señales (selección + lote) / Con señales | `counts` | Revisiones |
| `BatchApproveDialog` | AlertDialog | resumen por auditor, tope 50, confirmar | `selection` | Revisiones |
| `EscalateDialog`, `ReopenDialog`, `OverrideDialog`, `InviteAuditorDialog`, `DeactivateAccountDialog`, `ExportDialog`, `LayersDialog`, `ShortcutsDialog` | Dialog / AlertDialog | — | — | Varios |
| `FeedbackDrawer` | Sheet | validación (texto + llamada o motivo) | `agentId`, `preselectedCalls` | Ficha del ejecutivo |
| `Toast` | Sonner / Toast | con o sin Deshacer (10 s para el lote) | `action?` | Global |
| `EmptyState`, `ErrorState`, `Skeleton` | — | — | `title`, `body`, `action` | Global |
| `CommandPalette` | cmdk (Ctrl+K) | — | — | Global (no prototipado) |

### Interacciones y comportamientos

- **Atajos:**
  - `Espacio` reproduce o pausa; `←/→` ±5 s;
  - **`J` / `↓` siguiente · `K` / `↑` anterior** (C-04);
  - `C` confirma;
  - `X` lleva el foco al control de veredicto **sin preseleccionar** (C-03);
  - `E` escala;
  - `Enter` guarda y pasa al siguiente;
  - `A` aprueba y pasa al siguiente (supervisor, C-07);
  - `?` abre la ayuda; `Ctrl+K` abre los comandos.
  - Desactivables en Preferencias (WCAG 2.1.4). No se activan con el foco en un campo ni con un diálogo abierto.
- **Al abrir un caso:**
  - foco en el primer `non_compliant`/`uncertain`;
  - audio en pausa 4–5 s antes de la cita;
  - la columna del checklist se desplaza al ítem y la ficha, a la sección relevante (`FICHA_REL`: mapeo motivo → sección, como configuración, H-32).
- **Autoguardado** en cada acción, con el indicador "Guardado · hace un momento" (C-02).
- **Guardar deshabilitado** mientras haya dudosos, con el motivo en texto (`aria-live`).
- **Supervisor · Cambiar decisión:** entra en modo edición del checklist y el motivo se pide al guardar (C-08).
- **Lote:**
  - tope de 50;
  - resumen por auditor (C-13);
  - Deshacer durante 10 s;
  - si un caso cambia mientras se arma el lote, sale de él con aviso.
- **Contador de la cola con filtro:** "{n} de {total} con el filtro" (C-12).
- **Movimiento:** 120–200 ms; nada con `prefers-reduced-motion`.

---

## 3. Pantallas de alta fidelidad

Todas en `08-prototipo-alta-fidelidad.html`, con los estados del selector "Estado":
- Ingreso;
- Auditor: Cola, Detalle, Fin de jornada, Mis revisiones;
- Supervisor: Inicio, Alertas, Revisiones (dos carriles), Detalle en modo supervisor, Ejecutivos, Ficha del ejecutivo con drawer de feedback, Motivos con heatmap, Auditores (Desempeño y Cuentas), Cola completa;
- Diálogos: escalar, lote, reabrir, cambiar decisión, invitar, desactivar, exportar, capas y motor, atajos.

**Sin pantalla de alta fidelidad (documentadas en `04`/`06`):** invitación y activación, recuperación de contraseña, MFA, aviso de inactividad, ver PII sin enmascarar, paleta Ctrl+K y preferencias. Se derivan de los componentes y textos ya definidos.

---

## 4. Handoff a desarrollo

1. **Tokens:** copiar `08-tokens.css` a `frontend/src/styles/tokens.css` y mapear las variables en el tema de Tailwind (`colors.primary = "var(--primary)"`, etc.). `08-tokens.json` sirve para Style Dictionary u otra herramienta si se necesita.
2. **shadcn/ui:** inicializar con las variables semánticas de `08-tokens.css` (`--background`, `--primary`, `--ring`, …) y agregar los tokens `--verdict-*`, `--call-*` y `--source-*`.
3. **Componentes:** usar los nombres de la tabla de la sección 2; cada estado del design system es un caso de prueba visual.
4. **Textos:** `06-ux-writing.md` (con el ajuste §7 de D-20). Sin textos inventados en el código.
5. **Mapeo del contrato:** `compliant`/`non_compliant`/`uncertain` → textos por nivel (motivo / llamada); `not_applicable` → "Cumple" (pendiente técnico H-48).
6. **Accesibilidad:** criterios de `05` §4; validar con axe y con navegación solo por teclado los CUJ-1 y CUJ-5.
7. **Datos sintéticos:** los del prototipo sirven como fixtures del front (`tests/fixtures/`), siguiendo la regla de no usar datos reales.

### Lista de assets

| Asset | Fuente | Estado |
|---|---|---|
| Logo Qubico (símbolo + logotipo) | PNG del usuario | **Falta el SVG oficial**; hay una aproximación provisional en los HTML |
| Favicon | Derivado del símbolo | Pendiente del SVG oficial |
| Íconos | Lucide | Se instalan como dependencia; no hay archivos sueltos |
| Fuente | Archivo (Google Fonts) | Cargar con `next/font/google` (se autoaloja en el build) |
| Imágenes / ilustraciones | — | No se usan |

---

## 5. Verificación de licencias (L-13)

| Recurso | Licencia | Uso comercial | Nota |
|---|---|---|---|
| Archivo (tipografía) | SIL Open Font License 1.1 | Sí | Se puede autoalojar; no vender la fuente sola |
| Lucide (íconos) | ISC | Sí | Mantener el aviso de licencia en las dependencias |
| shadcn/ui | MIT | Sí | El código copiado queda en el repo |
| Radix UI, TanStack Table/Virtual, cmdk | MIT | Sí | — |
| wavesurfer.js | BSD-3-Clause | Sí | Mantener el aviso |
| Recharts (si se usa) | MIT | Sí | — |
| Design system "Modernist" del zip | **Desconocida** | **Verificar** | Solo se tomó la dirección visual vía `app.css` (tokens de color y radios). No se copió su CSS de componentes |
| Logo Qubico | Propiedad de Qubico | — | Falta el SVG oficial |
| Marca BancoEstado | De terceros | **No usar** | El nombre aparece solo dentro de los textos de la pauta (motivos 10 y 11), como contenido del cliente |

> Las licencias de las librerías se verifican al instalar la versión exacta (CLAUDE.md: verificar antes de citar).

---

## 6. Pendientes técnicos (no bloquean)

| ID | Pendiente | Para |
|---|---|---|
| H-34 | Estado `awaiting_approval` | `pipeline-architect` |
| H-48 | `not_applicable` en el contrato y en el prompt de la capa 2: mantenerlo y mapearlo a Cumple en el front (propuesta), o colapsarlo a `compliant` | `pipeline-architect`, `rubric-engineer` |
| H-32 | Mapeo motivo → sección de la ficha como configuración de la rúbrica | `rubric-engineer` |
| #25 | Proveedor de SSO | Cliente |
| HU-AUD-03 | Actualizar la historia: sin "No aplica" por motivo (D-20) | Johannes |
