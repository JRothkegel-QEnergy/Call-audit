# Cambio 12 · Administrador Qubico, invitaciones por correo y logo oficial

> Revisión rápida sobre lo aprobado (fases 0–8 y cambios 09, 10 y 11 de **este** repo, `call-audit-rcv`, rama `feature/deploy-v0`). Fecha: 2026-10-23.
> **Origen:** el Cambio 10 "Administrador Qubico" del worktree `call-audit` (aprobado 2026-10-22, D-26/D-27 de ese repo), sin SSO (D-28 de ese repo), más las decisiones de Johannes para esta implementación (§0).
> **Numeración:** este repo ya usa D-26 a D-31 (Cambio 11), H hasta H-65 y L hasta L-39. Este cambio usa **D-32 a D-40, H-66 a H-73 y L-40 a L-41**. Las referencias al otro worktree van como "call-audit 10 §x".
> **No contradice:**
> - `10-modo-real.md`: login sin SSO, sin atajos de demo, textos de error y ocultar lo que el backend no soporta;
> - `11-catalogo-seguros.md`: sección Seguros con el permiso `manage_catalog`, versionado de fichas y D-23 (sin rol "Calidad de la IA").
>
> **Front revisado:** `frontend/src/lib/api/types.ts` (`Role = auditor | supervisor`, `Permission = view_model_io | manage_catalog`), `components/shell/sidebar-nav.tsx`, `prompts/layer2/` (`prompt.yaml`, `system.txt`, `schema.json`, `prompt.lock.json`, `CHANGELOG.md`, `PROVENANCE.md`) y `scripts/prompt_bench/layer2_prompt.py` (`build` / `check`).

---

## 0. Decisiones (prevalecen sobre el resto del documento)

| # | Decisión | Efecto |
|---|---|---|
| D-32 | **Rol Administrador Qubico** (`qubico_admin`) tal como en call-audit 10 §2–§4, con los ajustes de abajo | `Role = "auditor" \| "supervisor" \| "qubico_admin"` |
| D-33 | **Versiones del prompt en un registro inmutable en la BD**, subidas desde la app, exportables al repo (call-audit 10, D-26) | Pendiente el ADR (`pipeline-architect`, `llm-engineer`) y el ajuste de la regla 2 de `CLAUDE.md` (lo hace Johannes o el ADR) |
| D-34 | **Dos formatos al publicar** (Johannes: "puede ser el prompt.yaml o el system prompt"): (a) **`prompt.yaml` completo**, con historial y origen por regla; el servidor lo valida como `layer2_prompt.py check` y genera `system.txt`; (b) **solo el system prompt** en texto | §2.2 |
| D-35 | **Probar contra la referencia corre el modelo de verdad** sobre el conjunto de calibración (llamadas con veredicto del cliente). Antes de correr se muestran *n* y el costo estimado; **solo corre si el admin confirma** | §2.3 |
| D-36 | **Sin verificación en dos pasos** (Johannes: "sin verificacion de dos pasos"). Se elimina la re-autenticación MFA al crear un admin, activar un prompt y volver atrás. Esas acciones quedan con **diálogo de confirmación**; activar y volver atrás mantienen el **motivo obligatorio** | Descarta el supuesto de MFA de call-audit 10 (allí H-61). El estado MFA desaparece de Cuentas |
| D-37 | **Invitación por correo** con enlace de activación **de un solo uso** para crear la contraseña. **Vence en 72 h; reenviar genera un enlace nuevo e invalida el anterior** **[SUPUESTO del coordinador, aceptado, H-66]** | §2.4 y §3.1–§3.2 |
| D-38 | **Logo oficial PNG** de Qubico (cubo + logotipo; negro y blanco para fondo oscuro) **reemplaza la aproximación provisional**. Sidebar colapsada (64 px): solo el cubo recortado del PNG | Cierra H-28. §2.5 |
| D-39 | **Sin SSO** (call-audit D-28): ni el login ni las invitaciones ni las tablas de cuentas muestran "Forma de ingreso"; `LoginMethod` queda solo con `"password"` | Coherente con `10-modo-real.md` 1a |
| D-40 | **El admin también tiene la sección Seguros**, como si tuviera `manage_catalog`, y es quien activa `manage_catalog` y `view_model_io` por cuenta **[SUPUESTO del diseñador, H-67]** | Hoy Qubico mantiene el catálogo; no cambia nada del Cambio 11 |

**Siguen vigentes** de call-audit 10:
- el admin sin dashboards de ejecutivos ni aprobación de revisiones (mínimo privilegio);
- un solo cliente con `clientId`;
- no se cambia el rol de una cuenta;
- si una versión empeora métricas, se advierte pero no se bloquea;
- una versión nueva solo afecta lotes futuros;
- el primer admin se crea por consola (bootstrap).

En este repo quedan como H-68 a H-73.
**Sesión del admin:** se mantienen los 15 min de inactividad aunque no haya MFA **[SUPUESTO, H-68]**.

---

## 1. Navegación y rutas (sin cambios respecto de call-audit 10, más Seguros)

| Rol | Navegación |
|---|---|
| Auditor | Cola · Mis revisiones |
| Supervisor | Inicio · Alertas · Revisiones · Ejecutivos · Motivos · Auditores · Cola · Discrepancias · Seguros (con `manage_catalog`) |
| **Admin Qubico** | **Estadísticas** · **Prompt** · **Cuentas** · Discrepancias · Seguros · **Registro de actividad** |

**Rutas:**
- `/admin/stats` · `/admin/prompts` · `/admin/prompts/new` · `/admin/prompts/[version]` · `/admin/accounts` · `/admin/activity`;
- pública, sin sesión: **`/invite/[token]`**;
- se comparten: `/discrepancies`, `/catalog` y `/calls/[id]` (solo lectura + panel del modelo + notas).

**Supervisor:** "Invitar auditor" **vuelve a mostrarse** cuando el backend soporte invitaciones. Hoy está oculto por `10-modo-real.md` 3b. Usa el mismo flujo de §2.4, con el rol fijo en auditor.

---

## 2. Diseño de lo que cambia frente a call-audit 10

### 2.1 Cuentas (`/admin/accounts`)

- **Columnas:** Nombre · Correo · Rol · Estado · Permisos · Último ingreso · Creada por.
  - Estados: **Invitada** (enlace vigente) / **Invitación vencida** / Activa / Desactivada.
  - Sin columnas "Forma de ingreso" ni "MFA".
- **"Invitar persona":** Nombre · Correo corporativo · Rol (Auditor / Supervisor / Administrador Qubico).
  - Los permisos dependen del rol: "Ver prompt y respuesta del modelo" para Auditor; "Administrar seguros" para Supervisor.
  - El botón principal es **"Enviar correo"**.
  - Si el rol es Administrador: aviso + confirmación (ver §3.4). **Sin MFA.**
- **Acciones por fila:** Reenviar invitación (solo Invitada o Invitación vencida) · Desactivar / Reactivar · Cambiar permisos.
- **"Restablecer contraseña"** envía un correo con un enlace de un solo uso, que vence en 72 h, y la misma pantalla `/invite/[token]` en modo restablecer. Reemplaza el "escríbele a tu contacto en Qubico" de `10-modo-real.md` 1d **solo cuando el backend lo soporte** **[SUPUESTO, H-69]**.

### 2.2 Publicar una versión (`/admin/prompts/new`)

1. **Formato** (control segmentado):
   - **"prompt.yaml (recomendado)"**: archivo `.yaml`;
   - **"Solo system prompt"**: archivo `.txt` o texto pegado.
2. **Validación al subir** (servidor):
   - **prompt.yaml:** las mismas reglas de `layer2_prompt.py check` (estructura, ítems, orígenes válidos del historial, esquema de salida y versión).
     - Si falla, lista de errores con ubicación ("Ítem motivo 28 · history[2]: origen «x» no existe"); no se guarda.
     - Si pasa, se **genera `system.txt`** y se muestra la vista previa.
   - **Solo system prompt:** se valida que no esté vacío y que el esquema de salida vigente siga aplicando (se usa `schema.json` vigente).
     - Aviso fijo: "Esta versión no tiene historial ni origen por regla. Para conservar la trazabilidad por regla, sube el prompt.yaml." **[SUPUESTO, H-70]**
3. **Versión:**
   - en el formato del proyecto, **`X.Y`** como en `prompt.yaml` (hoy `2.10`), **no semver de 3 números**;
   - debe ser mayor que la vigente;
   - con prompt.yaml se lee del archivo y no se edita a mano; si no coincide con lo esperado, error.
   - Esto ajusta call-audit 10 §4.2, que pedía semver.
4. **Modelo**, **Qué cambió** (obligatorio; con prompt.yaml se precarga desde el historial de las reglas modificadas) y **Por qué** (opcional).
5. **Guardar como borrador.**

**Diferencias** (`/admin/prompts/[version]`, pestaña Diferencias):
- **prompt.yaml vs prompt.yaml:** **por regla** (motivo o ítem). Para cada regla cambiada, texto anterior → nuevo y el **origen** de la entrada nueva del historial (Texto oficial, Feedback del cliente, Feedback de validación, …).
- Cualquier otro par: diferencia de texto del `system.txt` generado.

**Exportar al repo:** "Descargar para el repo".
- Con prompt.yaml: un zip con `prompt.yaml`, `system.txt`, `prompt.lock.json` y la entrada de `CHANGELOG.md`.
- Con solo system prompt: `system.txt` + metadatos.

### 2.3 Probar contra la referencia (con costo, D-35)

- **"Probar contra la referencia"** abre el **diálogo de costo** (§3.3), con:
  - *n* de llamadas del conjunto de calibración (las que traen veredicto del cliente);
  - modelo;
  - costo estimado;
  - tiempo estimado.
- **El costo estimado sale del costo promedio registrado por llamada de las últimas corridas de ese modelo** (lo que guarda cada `ModelRun`), nunca de precios escritos en el front (`CLAUDE.md`). Si no hay corridas previas del modelo: "No hay costo registrado para este modelo; no podemos estimarlo." y el botón cambia a "Correr sin estimación".
- **Al confirmar:** estado **En prueba**, con barra de progreso ({k} de {n}) y opción **"Detener prueba"**. Si se detiene, queda en **Error de prueba** con "Detenida por {persona} en {k} de {n}"; lo ya gastado se muestra.
- **Al terminar:** **Probada**, con el costo real de la prueba junto a las métricas, lado a lado con la vigente.
- La prueba **no** crea casos en la cola ni toca resultados de producción.

### 2.4 Invitación y activación (D-37)

- **Al invitar:** se envía el correo (§3.1), la cuenta queda **Invitada** y el enlace vence en **72 h**.
- **Reenviar:** genera un enlace nuevo, invalida el anterior y reinicia las 72 h.
- **`/invite/[token]`** (§3.2), pública, con estados:
  - **válido:** formulario para crear la contraseña;
  - **vencido;**
  - **ya usado;**
  - **anulado** (la cuenta se desactivó o se reenvió otra invitación);
  - al activar, entra directo a la app según su rol.
- **Contraseña:**
  - mínimo 12 caracteres **[SUPUESTO, H-71]**;
  - se permite pegar y usar el gestor de contraseñas (WCAG 3.3.8);
  - botón "Mostrar" para revelarla;
  - **un solo campo**, más el botón Mostrar, en vez de "repetir contraseña" (WCAG 3.3.7, no pedir dos veces lo mismo) **[SUPUESTO, H-72]**.
- El token va en la URL (es un identificador opaco, no PII). Al usarse se invalida y **no se registra en logs**.

### 2.5 Logo oficial (D-38)

| Lugar | Asset | Tamaño |
|---|---|---|
| Sidebar expandida (232 px) | Logo completo negro (cubo + logotipo) + "Auditoría de llamadas" debajo en `--muted-foreground` 12 px | Alto 28 px |
| Sidebar colapsada (64 px) | **Solo el cubo**, recortado del PNG, con área transparente | 28 × 28 px |
| Login · panel oscuro | Logo completo **blanco** | Alto 40 px |
| Correo de invitación | Logo completo negro sobre blanco | Alto 32 px |
| Favicon | Cubo | 32 y 180 px |

- **Assets** (en `frontend/public/brand/` **[SUPUESTO de ruta]**): `qubico-logo.png`, `qubico-logo-white.png` y `qubico-mark.png` (cubo), en **2×** para pantallas de alta densidad.
- **Área de resguardo:** la altura de un nodo del cubo.
- `alt="Qubico"` en el logo de la sidebar y del login. El cubo de la sidebar colapsada es decorativo (`alt=""`) porque el botón ya tiene nombre accesible.
- Se retira la aproximación SVG provisional de `08-*.html` y del front. **H-28 cerrada.**

---

## 3. Textos nuevos (complementan `06` y call-audit 10 §5)

### 3.1 Correo de invitación

- **Asunto:** `Te invitaron a Call Audit`
- **Remitente:** `Call Audit · Qubico` **[SUPUESTO: dirección `no-responder@` del dominio de Qubico, H-73]**
- **Cuerpo:**

> **[logo Qubico]**
>
> Hola, {nombre}:
>
> {nombre_quien_invita} te invitó a **Call Audit**, la herramienta de auditoría de llamadas de {cliente}, con el rol **{rol}**.
>
> Te invitaron a Call Audit. Crea tu contraseña para activar tu cuenta.
>
> **[ Crear contraseña ]**
>
> El enlace vence el {fecha} a las {hora} (72 horas) y sirve una sola vez.
> Si el botón no funciona, copia este enlace en tu navegador: {url}
>
> Si no esperabas esta invitación, ignora este correo: tu cuenta no se activará.
>
> — Qubico

- **Versión de solo texto:** el mismo contenido, sin el logo ni el botón (con la URL en su lugar).
- **Correo de restablecimiento** (H-69):
  - asunto `Restablece tu contraseña de Call Audit`;
  - cuerpo: "Recibimos una solicitud para restablecer tu contraseña. **[ Crear contraseña nueva ]** El enlace vence en 72 horas y sirve una sola vez. Si no lo pediste, ignora este correo."

### 3.2 Pantalla `/invite/[token]`

| Estado | Título | Cuerpo | Acción |
|---|---|---|---|
| Válido | Activa tu cuenta | {nombre_quien_invita} te invitó a Call Audit como {rol}. Crea tu contraseña para activar tu cuenta. · Correo: {correo} (solo lectura) | Campo **Contraseña** + "Mostrar" · ayuda "Usa al menos 12 caracteres." · casilla sin marcar "Leí y acepto los Términos de uso." + enlace al Aviso de privacidad · botón **Activar cuenta** |
| Error de contraseña | — | "Usa al menos 12 caracteres." (junto al campo, con ícono) | — |
| Activando | — | — | Botón "Activando…" deshabilitado |
| Vencido | Esta invitación venció | El enlace dejó de funcionar el {fecha}. Pide una nueva a quien te invitó. | — |
| Ya usado | Esta invitación ya se usó | Tu cuenta ya está activa. | **Ir a ingresar** |
| Anulado | Esta invitación ya no es válida | Se envió una invitación más nueva o la cuenta fue desactivada. Revisa tu correo o pide una nueva a quien te invitó. | — |
| Restablecer (válido) | Crea una contraseña nueva | Para {correo}. | Campo **Contraseña nueva** + "Mostrar" · **Guardar contraseña** |

### 3.3 Diálogo de costo de la prueba

| Elemento | Texto |
|---|---|
| Título | ¿Probar v{versión} contra la referencia? |
| Cuerpo | Se correrá el modelo **{modelo}** sobre **{n} llamadas** que traen el veredicto del cliente. |
| Costo | **Costo estimado: {usd} USD** ({usd_por_llamada} USD por llamada, según las últimas corridas de este modelo). |
| Tiempo | Tiempo estimado: {minutos} min. Puedes detener la prueba en cualquier momento. |
| Sin estimación | No hay costo registrado para este modelo; no podemos estimarlo. |
| Nota | La prueba no cambia resultados ni crea casos en la cola. |
| Botones | **Correr prueba · {usd} USD** / **Correr sin estimación** (sin dato) · Cancelar |
| En curso | Probando v{versión} · {k} de {n} llamadas · {usd_gastado} USD · Detener prueba |
| Detenida | Prueba detenida por {persona} en {k} de {n} llamadas. Costo: {usd_gastado} USD. · Reintentar |
| Terminada | Prueba terminada · {n} llamadas · Costo real: {usd_real} USD |

### 3.4 Confirmaciones sin MFA (D-36)

| Acción | Título | Cuerpo | Botón |
|---|---|---|---|
| Invitar admin | ¿Invitar a {nombre} como Administrador Qubico? | Tendrá acceso a cuentas, prompt, seguros y estadísticas. | Enviar correo |
| Activar versión | ¿Activar el prompt v{nueva}? | Reemplaza a v{vigente} para los lotes que lleguen desde ahora. Las llamadas ya procesadas no cambian. · **Motivo de la activación (obligatorio)** | Activar v{nueva} |
| Volver atrás | ¿Volver al prompt v{anterior}? | v{vigente} queda retirada. Se aplica a los lotes que lleguen desde ahora. · **Motivo (obligatorio)** | Volver a v{anterior} |
| Desactivar admin | ¿Desactivar a {nombre}? | No podrá ingresar. Debe quedar al menos un Administrador Qubico activo. | Desactivar cuenta |

### 3.5 Errores de validación del prompt.yaml

- **Título:** "El prompt.yaml tiene {n} errores"
- **Cada línea:** "{ubicación}: {mensaje}"
- **Pie:** "Corrígelos y vuelve a subir el archivo. Es la misma validación de `layer2_prompt.py check`."

---

## 4. Impacto en `types.ts` y `ApiClient` (no es código)

**Tipos**
- `Role` suma `"qubico_admin"`.
- `Permission` se mantiene (`view_model_io`, `manage_catalog`).
- `LoginMethod` queda en `"password"`.
- `UserAccount`: `{ id, name, email, role, status: "invited" | "invite_expired" | "active" | "deactivated", permissions, lastLoginAt, createdBy, createdAt, inviteExpiresAt? }`. Sin campo MFA.
- `PromptVersion`: `{ version: string /* "X.Y" */, format: "yaml" | "system_text", status: "draft" | "testing" | "test_failed" | "tested" | "active" | "retired", model, changelog, rationale?, createdBy, createdAt, activatedBy?, activatedAt?, activationReason?, retiredAt?, systemText, yaml?, validationErrors? }`
- `PromptEvaluation`: suma `{ estimatedCostUsd, actualCostUsd, n, processed, stoppedBy? }` a lo de call-audit 10 §6.
- `PromptDiff`: `{ mode: "by_rule" | "text", rules?: { id, before, after, origin }[], text? }`.
- `InviteToken` (público): `{ status: "valid" | "expired" | "used" | "revoked", purpose: "invite" | "reset", email?, inviterName?, role?, expiresAt? }`.

**`ApiClient` (nuevos o cambiados)**
- Invitaciones y cuentas:
  - `inviteUser({ name, email, role, permissions })`
  - `resendInvite(accountId)`
  - `sendPasswordReset(accountId)`
  - `getInvite(token)` y `acceptInvite(token, { password, acceptTerms })`
- Prompt:
  - `uploadPromptVersion({ format, file | text, model, changelog, rationale })`, que devuelve la versión o `validationErrors`
  - `estimatePromptEvaluation(version)`, que devuelve `{ n, model, estimatedCostUsd | null, estimatedMinutes }`
  - `startPromptEvaluation(version)` · `stopPromptEvaluation(version)` · `exportPromptVersion(version)`
- **Se eliminan** `reauthenticate` y `resetMfa`.

**Para el ADR** (`pipeline-architect`, `llm-engineer`):
- validación del prompt.yaml en el servidor, reutilizando `layer2_prompt.py`;
- generación de `system.txt` y `prompt.lock.json`;
- versión vigente por lote;
- conjunto de calibración;
- evaluación asíncrona que se puede detener;
- registro de costo por corrida;
- exportación al repo.

---

## 5. Supuestos de este cambio

| ID | Supuesto |
|---|---|
| H-66 | El enlace de invitación vence en 72 h; reenviar genera uno nuevo e invalida el anterior |
| H-67 | El admin tiene la sección Seguros y gestiona `manage_catalog` y `view_model_io` por cuenta |
| H-68 | Sesión de 15 min de inactividad para el admin, aunque no haya MFA |
| H-69 | Restablecer contraseña por correo con enlace de un solo uso, cuando el backend lo soporte; hasta entonces sigue `10-modo-real.md` 1d |
| H-70 | Una versión "Solo system prompt" no tiene historial ni origen por regla; se avisa y se recomienda el prompt.yaml |
| H-71 | Contraseña de mínimo 12 caracteres, sin reglas de composición |
| H-72 | Un solo campo de contraseña con "Mostrar", en vez de "repetir contraseña" |
| H-73 | Remitente `Call Audit · Qubico`, desde una dirección no-responder del dominio de Qubico |
