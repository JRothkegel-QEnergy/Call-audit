# Cambio 10 · Rol Administrador Qubico

> Revisión rápida sobre el diseño aprobado (fases 0–8 y Cambio 09). Fecha: 2026-10-22.
> **Pedido de Johannes (textual):** "Quiero q hagas un rol especial que sea el de administrador Qubico. Aquí podremos crear cuentas para otras personas, actualizar el prompt cambiándolo por otro, ver estadísticas, etc"
> **Toca:**
> - la AI (rol, navegación y rutas nuevos);
> - D-12 / H-27 (alta de supervisores), D-23 (calibración desde Qubico) y 09 §2.1 (prompt no editable desde la app);
> - la regla no negociable 2 de `CLAUDE.md`;
> - el Registro Legal.
>
> No se reabren otras fases. Front revisado: `src/lib/api/types.ts`, `src/lib/api/client.ts`, `components/shell/sidebar-nav.tsx`.

---

## 0. Cierre del cambio (2026-10-22) · prevalece sobre el resto del documento

**Estado: aprobado.** Johannes respondió **(b)** a la pregunta del almacenamiento del prompt.

| # | Decisión | Efecto |
|---|---|---|
| D-26 | **Las versiones del prompt se suben desde la app a un registro inmutable en la base de datos**, con autor, fecha, changelog y motivo, y son **exportables al repo** (`prompts/`) | La fuente de verdad del prompt pasa a ser el registro versionado. **Pendiente:** ADR con `pipeline-architect` y `llm-engineer`, y ajuste de la regla no negociable 2 de `call-audit/CLAUDE.md` (lo hace Johannes o el ADR; el diseñador no lo edita) |
| D-27 | Se aprueba el rol **Administrador Qubico** tal como está en §1–§7 | C10-1 a C10-7 |
| — | Siguen como **supuestos vigentes, sin objeción**: H-59 (primer admin por script), H-60 (admin sin dashboards de ejecutivos ni aprobación), H-61 (MFA y sesión de 15 min), H-62 (un solo cliente con `clientId`), H-63 (no se cambia el rol), H-64 (empeorar métricas advierte, no bloquea), H-65 (solo lotes futuros) | — |

> **Ajuste 2026-10-23 (D-28):** sin SSO en el MVP. "Invitar persona" no tiene "Forma de ingreso" y la tabla de Cuentas no tiene esa columna. MFA y re-autenticación del admin siguen igual.

### Flujo definitivo de una versión

1. **Subir:** en `/admin/prompts/new` se sube el archivo o se pega el texto (por secciones: system, reglas de revisión, plantilla del mensaje), con versión semver mayor que la vigente, modelo, qué cambió y por qué. Se guarda como **Borrador**, editable solo por su autor y con autoguardado.
2. **Probar:** "Probar contra la referencia" la pasa a **En prueba**, donde queda **inmutable** y corre la evaluación asíncrona sobre el conjunto de calibración. Al terminar queda **Probada**, con métricas lado a lado contra la vigente. Si la evaluación falla, queda en **Error de prueba**, con el motivo y "Reintentar"; sigue inmutable.
3. **Activar:** solo desde Probada. Pide resumen, motivo obligatorio y MFA. Pasa a **Vigente**, y la anterior a **Retirada**. Se aplica a los lotes que lleguen desde ese momento.
4. **Volver atrás:** desde la vigente, "Volver a v{x}" (cualquier Retirada que haya sido Probada), con el mismo diálogo. Nada se borra.
5. **Exportar al repo:** "Descargar para el repo" en cualquier versión no borrador: archivo del prompt + metadatos (versión, changelog, autor, fecha) en el formato de `prompts/`. Cómo se sincroniza con git lo define el ADR **[SUPUESTO: descarga manual en el MVP]** (H-66).
6. **Descartar borrador:** solo los borradores se pueden eliminar. Una versión que llegó a prueba nunca se borra.

### Estados (`PromptVersionStatus`)

`draft` (Borrador) · `testing` (En prueba) · `test_failed` (Error de prueba) · `tested` (Probada) · `active` (Vigente) · `retired` (Retirada).

"Error de prueba" es un estado nuevo frente a §4.2.

---

## 1. Resumen de decisiones

| # | Decisión | Reemplaza o ajusta |
|---|---|---|
| C10-1 | Rol nuevo **Administrador Qubico** (`qubico_admin`): cuentas de todos los roles, versiones del prompt, estadísticas de operación y de la IA, calibración (Discrepancias + panel del modelo) y registro de actividad | — |
| C10-2 | **El admin crea supervisores (y otros admins) desde la app.** El supervisor sigue creando solo auditores | D-12, H-27 (alta de supervisores por script → ahora en la app). El **primer** admin se crea por script (bootstrap) **[SUPUESTO, H-59]** |
| C10-3 | **El admin absorbe la calibración de Qubico:** Discrepancias, clasificación, panel del modelo y notas. El supervisor conserva Discrepancias (D-23 sigue para el cliente) | D-23 |
| C10-4 | **"Actualizar el prompt" = publicar una versión nueva e inmutable y activarla**, nunca editar en caliente: versión semántica obligatoria, changelog, diferencias contra la vigente, prueba contra la referencia, activación explícita con confirmación y volver a una versión anterior | 09 §2.1 ("no se edita desde la app"): se permite **publicar y activar versiones**, no editar. **Requiere ADR** (pregunta 1) |
| C10-5 | **Mínimo privilegio:** el admin **no** ve dashboards de ejecutivos ni registra feedback, no aprueba revisiones y no ve PII sin enmascarar (salvo el flujo de L-04, con motivo y log). Quien de Qubico necesite funciones de supervisor usa además una cuenta de supervisor **[SUPUESTO, H-60]** | — |
| C10-6 | **MFA obligatorio** para el admin, aunque entre por SSO (o exigido al proveedor de SSO), y **sesión de 15 min** de inactividad **[SUPUESTO, H-61]** | H-36 (30 min para el resto) |
| C10-7 | **Un solo cliente en el MVP** (BancoEstado Corredores). El modelo de datos lleva `clientId` desde ya y el encabezado del admin muestra el cliente, sin selector **[SUPUESTO, H-62]** | Brief §4 (multi-cliente fuera del MVP) |

---

## 2. Rol y permisos

| Capacidad | Auditor | Supervisor | **Admin Qubico** |
|---|:-:|:-:|:-:|
| Revisar casos (Cola, detalle, guardar) | ✓ | — | — |
| Aprobar, reabrir o cambiar revisiones | — | ✓ | — |
| Inicio, Alertas, Ejecutivos, Motivos, feedback | — | ✓ | — (L-06) |
| Desempeño de auditores | — | ✓ | — (L-22) |
| Discrepancias y clasificación | — | ✓ | ✓ |
| Panel "Prompt y respuesta del modelo" | con `view_model_io` | ✓ | ✓ |
| Detalle de llamada | edición | modo supervisor | **solo lectura** + notas |
| Crear cuentas de auditor | — | ✓ (de su empresa) | ✓ |
| Crear cuentas de supervisor y de admin | — | — | ✓ |
| Dar o quitar `view_model_io` | — | — | ✓ |
| Desactivar o reactivar cuentas, reenviar invitación, restablecer MFA | — | auditores | todas (salvo la propia) |
| Versiones del prompt: publicar, probar, activar, volver atrás | — | ver la vigente (en el panel) | ✓ |
| Estadísticas de operación y de la IA | — | — | ✓ |
| Registro de actividad | — | — | ✓ |
| Exportar con PII | con permiso | con permiso | con permiso (mismo flujo, L-04) |

**Reglas**
- Un admin **no puede desactivarse a sí mismo** ni quitarse el rol.
- Siempre debe quedar **al menos un admin activo**.
- Crear o desactivar un admin pide **reingresar el código MFA** (re-autenticación).

---

## 3. Navegación y rutas

| Rol | Navegación (en orden) |
|---|---|
| Auditor | Cola · Mis revisiones *(sin cambios)* |
| Supervisor | Inicio · Alertas · Revisiones · Ejecutivos · Motivos · Auditores · Cola · Discrepancias *(sin cambios)* |
| **Admin Qubico** | **Estadísticas** · **Prompt** · **Cuentas** · Discrepancias · **Registro de actividad** |

| Ruta | Vista |
|---|---|
| `/admin` → redirige a `/admin/stats` | Inicio del admin |
| `/admin/stats` | Estadísticas (pestañas: Operación · Calidad de la IA · Costo) |
| `/admin/prompts` | Versiones del prompt (lista) |
| `/admin/prompts/new` | Publicar una versión nueva |
| `/admin/prompts/[version]` | Detalle de una versión: diferencias, métricas, activar o volver atrás |
| `/admin/accounts` | Cuentas (todos los roles) |
| `/admin/activity` | Registro de actividad |
| `/discrepancies` | Compartida con el supervisor (Cambio 09) |
| `/calls/[id]` | Detalle en modo **solo lectura** + panel del modelo + notas |

- El encabezado de las páginas del admin muestra "Cliente: BancoEstado Corredores de Seguros" como texto, sin selector (C10-7).
- El admin entra a `/admin/stats`.

---

## 4. Diseño mínimo de cada pantalla

### 4.1 Cuentas (`/admin/accounts`)

- **Tabla:**
  - Nombre · Correo · Rol · Estado (Invitado / Activo / Desactivado) · Forma de ingreso · MFA (Activo / Pendiente) · Permisos (`Ver prompt`) · Último ingreso · Creada por.
  - Filtros por rol y estado, y búsqueda por nombre o correo.
  - La búsqueda de cuentas **no** se registra como búsqueda de ejecutivo, pero sí queda en el registro de actividad si se abre el detalle.
- **"Invitar persona"** (diálogo):
  - nombre, correo corporativo, **rol** (Auditor / Supervisor / Administrador Qubico) y forma de ingreso;
  - el permiso "Ver prompt y respuesta del modelo" aparece solo para Auditor;
  - si el rol es Administrador, aviso: "Tendrá acceso a cuentas, prompt y estadísticas. Requiere MFA." y re-autenticación.
- **Acciones por fila:**
  - Reenviar invitación · Desactivar / Reactivar · Restablecer MFA · Cambiar permiso "Ver prompt" (solo auditores).
  - **Cambiar de rol no se permite** (se desactiva y se invita de nuevo), así cada cuenta conserva un rol trazable **[SUPUESTO, H-63]**.
- Cada acción queda en el **Registro de actividad** (L-17, L-24).

### 4.2 Versiones del prompt (`/admin/prompts`)

**Lista**
- Columnas: Versión · Estado · Modelo · Fecha · Autor · Cambios (primera línea del changelog) · Coincidencia con el cliente · Dudosas · Costo por llamada.
- **Estados:** Borrador → En prueba → Probada → **Vigente** → Retirada.
- Una sola versión vigente a la vez.

**Publicar una versión nueva** (`/admin/prompts/new`)
1. **Archivo o texto del prompt**, con las mismas secciones que el vigente: system, reglas de revisión, plantilla del mensaje.
2. **Versión:** semver obligatoria y **mayor** que la vigente. Se sugiere la siguiente menor (ej. 2.8.0). Ayuda: "Mayor si cambia el esquema de salida, menor si cambian reglas o criterios, parche si son correcciones de redacción".
3. **Modelo** con el que se corre (lista de los configurados; hoy Gemini y Sonnet).
4. **Qué cambió** (changelog, obligatorio) y **por qué** (enlace opcional a discrepancias o notas que lo motivan).
5. **Guardar como borrador.** Se puede editar mientras es borrador. Al pasar a "En prueba" **queda inmutable**: cualquier cambio posterior exige una versión nueva.

**Detalle de una versión** (`/admin/prompts/[version]`)
- **Pestaña "Diferencias":** comparación lado a lado o unificada contra la vigente (o contra cualquier otra), con plegado de lo que no cambió.
- **Pestaña "Prueba":**
  - "Probar contra la referencia" corre la versión sobre el **conjunto de calibración**: llamadas con veredicto del cliente y/o revisiones cerradas de los auditores de la app.
  - Muestra el progreso y luego las métricas **lado a lado con la vigente**, siempre con su referencia y su *n*: coincidencia con el cliente, coincidencia con los auditores de la app, % de Dudosas, Solo la IA detectó, Omitidos por la IA, citas no validadas, costo por llamada y latencia.
  - Más un desglose por motivo, para ver dónde mejora o empeora.
- **Pestaña "Historial":** quién la creó, probó, activó y retiró, y cuándo.
- **Activar:** solo en versiones "Probadas".
  - Diálogo con resumen: versión actual → nueva, métricas clave y la advertencia "Se usará para los lotes que lleguen desde ahora. Las llamadas ya procesadas no cambian."
  - Pide **motivo de la activación** y re-autenticación con MFA.
  - Si la versión empeora una métrica contra la vigente, el diálogo lo destaca. No lo bloquea **[SUPUESTO]**.
- **Volver a la versión anterior:** en la vigente, "Volver a v{x}" usa el mismo diálogo; la anterior vuelve a "Vigente" y la actual pasa a "Retirada". Nada se borra.
- **Reprocesar lotes anteriores** con la nueva versión **queda fuera del MVP**: requiere ADR, porque cambia resultados ya revisados por personas.
- **Aviso a los usuarios:** al activar una versión, los supervisores ven en Inicio un banner "Desde el {fecha} se usa el prompt v{x}" y el panel del modelo muestra la versión de cada llamada (trazabilidad, regla 3).

### 4.3 Estadísticas (`/admin/stats`)

Sin métricas por persona (auditores, ejecutivos o auditores del cliente), para no chocar con L-06, L-22 y L-31. No duplica el Inicio del supervisor: aquí se mide **el sistema**, no la calidad de las llamadas.

| Pestaña | Métricas | Visual |
|---|---|---|
| **Operación** | Llamadas y minutos procesados por día y por lote · tiempo desde la llegada del lote hasta el resultado (meta < 24 h) · lotes con error y tipo (ingesta, ASR, modelo, salida inválida) · llamadas en cola de revisión humana y su antigüedad · casos revisados por día (total del equipo, no por persona) | KPI + línea diaria + tabla de lotes con error |
| **Calidad de la IA** | Por versión de prompt y por modelo: coincidencia con el cliente · coincidencia con los auditores de la app · % de Dudosas · % de citas no validadas · distribución Cumple / No cumple / Dudosa (alerta de drift si se mueve más de `TBD` puntos) · metas FP ≤ 5 % y FN ≤ 20 % cuando la referencia lo permita | Tabla por versión + línea por versión en el tiempo; toda métrica con su referencia y su *n* |
| **Costo** | Costo total y por llamada por modelo y versión · tokens de entrada y salida · latencia media y p95 | KPI + barras por modelo. Los costos salen de lo **registrado por cada corrida**, nunca de precios escritos en el front (CLAUDE.md) |

- **Filtros:** rango de fechas, modelo, versión de prompt y lote.
- **Exportar CSV**, sin PII.

### 4.4 Registro de actividad (`/admin/activity`)

- **Tabla de solo lectura:** Fecha · Persona · Rol · Acción · Objeto · Detalle.
- **Acciones registradas:**
  - cuentas: crear, desactivar, reactivar, cambiar permiso, restablecer MFA;
  - prompt: publicar, probar, activar, volver atrás;
  - ver PII sin enmascarar;
  - exportar con PII;
  - búsquedas por ejecutivo (D-13);
  - ingresos fallidos repetidos.
- **Filtros:** persona, acción y fechas. Exportar CSV.
- **No se puede editar ni borrar** (L-33).

### 4.5 Detalle de llamada en modo admin

- Igual que el del supervisor, pero **sin barra de aprobación**: banner "Estás viendo esta llamada en solo lectura".
- Panel del modelo y notas disponibles; veredicto y comentario del cliente visibles (como el supervisor, D-24).

---

## 5. Textos clave (complementan `06`)

| Elemento | Texto |
|---|---|
| Rol | Administrador Qubico |
| Cuentas · título | Cuentas |
| Cuentas · subtítulo | Personas con acceso a Call Audit en BancoEstado Corredores de Seguros. |
| Botón | Invitar persona |
| Aviso para el rol admin | Tendrá acceso a cuentas, prompt y estadísticas. Requiere verificación en dos pasos. |
| Re-autenticación | Para continuar, escribe el código de tu app de verificación. |
| No puede desactivarse | No puedes desactivar tu propia cuenta. |
| Último admin | Debe quedar al menos un Administrador Qubico activo. |
| Prompt · título | Versiones del prompt |
| Prompt · subtítulo | Cada versión es inmutable una vez que entra en prueba. Solo una está vigente. |
| Estados | Borrador · En prueba · Probada · Vigente · Retirada |
| Versión · ayuda | Mayor si cambia el formato de salida; menor si cambian reglas o criterios; parche si son correcciones de redacción. |
| Versión · error | La versión debe ser mayor que la vigente (v{x}). |
| Changelog | Qué cambió · Por qué |
| Probar | Probar contra la referencia |
| Referencia | Referencia: auditoría del cliente · {n} llamadas · Auditores de la app · {m} casos |
| Activar · título | ¿Activar el prompt v{nueva}? |
| Activar · cuerpo | Reemplaza a v{vigente} para los lotes que lleguen desde ahora. Las llamadas ya procesadas no cambian. |
| Activar · empeora | Esta versión baja la coincidencia con el cliente de {a} a {b}. |
| Activar · motivo | Motivo de la activación (obligatorio) |
| Activar · botón | Activar v{nueva} |
| Volver atrás | Volver a v{anterior} |
| Banner para supervisores | Desde el {fecha} se usa el prompt v{x}. |
| Estadísticas · nota | Métricas del sistema. No se muestran indicadores por persona. |
| Solo lectura | Estás viendo esta llamada en solo lectura. |
| Registro · subtítulo | Registro de acciones sensibles. No se puede editar ni borrar. |

---

## 6. Impacto en `types.ts` y `ApiClient` (no es código)

**Tipos**

| Tipo | Cambio |
|---|---|
| `Role` | `"auditor" \| "supervisor" \| "qubico_admin"` |
| `User` | Suma `clientId`, `mfaEnabled` y `lastLoginAt` |
| `AuditorAccount` → `UserAccount` | Generalizar a `{ id, name, email, role, status, loginMethod, mfa: "active" \| "pending", permissions, lastLoginAt, createdBy, createdAt }`. El supervisor sigue viendo solo `role = auditor` |
| `PromptVersion` | `{ version (semver), status: "draft" \| "testing" \| "tested" \| "active" \| "retired", model, changelog, rationale?, createdBy, createdAt, activatedBy?, activatedAt?, activationReason?, retiredAt? }` |
| `PromptEvaluation` | `{ version, startedAt, finishedAt?, status, references: { kind: "client" \| "app_auditors", n, matchRate, uncertainRate, aiOnlyFail, aiMissedFail, unvalidatedQuoteRate }[], costPerCallUsd, latencyMsP50, latencyMsP95, byCriterion: {...}[] }` |
| `PromptDiff` | Texto unificado o por secciones |
| `AdminStats` | `{ operation: {...}, aiQuality: {...por versión y modelo}, cost: {...} }`, todo con referencia y *n* |
| `ActivityLogEntry` | `{ at, actorId, actorName, actorRole, action, target, details }` |
| `ModelRun` | Sigue (Cambio 09); `promptVersion` enlaza a `PromptVersion` |

**`ApiClient` (nuevos)**
- `listAccounts(filters)` · `inviteUser({ name, email, role, loginMethod, permissions })` · `setAccountStatus` (generalizado) · `setAccountPermissions` · `resendInvite` · `resetMfa` · `reauthenticate(code)`
- `listPromptVersions` · `getPromptVersion` · `getPromptDiff(a, b)` · `createPromptDraft` · `updatePromptDraft` · `startPromptEvaluation(version)` · `getPromptEvaluation(version)` · `activatePromptVersion(version, { reason, reauthToken })`
- `getAdminStats(range, filters)` · `listActivity(filters)`

**Pendientes para ADR** (`pipeline-architect` + `llm-engineer`)
- dónde viven las versiones del prompt (pregunta 1);
- cómo resuelve el pipeline la versión vigente por lote;
- conjunto de calibración y evaluación asíncrona;
- reprocesar lotes (fuera del MVP).

---

## 7. Accesibilidad y patrones (comprobación rápida)

- **Diferencias:** texto y símbolo (`+` / `−`) además del color. Fuente monoespaciada 13/20. Navegación por cambio con teclado (siguiente / anterior).
- **Diálogos de activación y re-autenticación:**
  - patrón AlertDialog;
  - el botón repite la acción ("Activar v2.8.0");
  - el código MFA se puede pegar (WCAG 3.3.8).
- **Estadísticas:** gráficos con tabla alternativa (`05` §4); fuente y *n* visibles.
- **Dark patterns:** ninguno. Desactivar cuentas es tan fácil como crearlas y "Volver atrás" está a la vista.

---

## 8. Supuestos de este cambio

| ID | Supuesto |
|---|---|
| H-59 | El primer Administrador Qubico se crea por script (bootstrap); los siguientes, desde la app |
| H-60 | El admin no tiene funciones de supervisor; si alguien de Qubico las necesita, usa además una cuenta de supervisor |
| H-61 | MFA obligatorio y sesión de 15 min de inactividad para el admin |
| H-62 | Un solo cliente en el MVP; `clientId` en el modelo de datos desde ya |
| H-63 | No se cambia el rol de una cuenta: se desactiva y se invita de nuevo |
| H-64 | Activar una versión que empeora métricas se advierte, pero no se bloquea |
| H-65 | Una versión nueva solo afecta lotes futuros; reprocesar queda fuera del MVP |
