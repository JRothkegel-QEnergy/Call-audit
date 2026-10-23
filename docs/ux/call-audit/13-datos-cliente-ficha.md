# Cambio 13 · Ficha del cliente (datos de la metadata) en la Ficha del seguro

> Revisión rápida sobre lo aprobado (fases 0–8 y cambios 09–12). Fecha: 2026-10-23. Pedido de Johannes: "en la sección donde sale Ficha del seguro, también agregues la información que venía por metadata que sirva para la revisión, ejemplo nombre del cliente, rut del cliente".
> **Numeración:** D-41 a D-46, H-74 a H-78. Sin ítems L nuevos (preferencia de Johannes: lo legal se ve cuando él lo pida).
> **Front revisado:** `frontend/src/components/call/product-sheet.tsx`, `frontend/src/app/(app)/calls/[id]/call-detail.tsx` (columna ~483, botón ~346/~490, drawer ~577), `frontend/src/lib/api/types.ts` (`ProductSheet`, `ProductSheetSectionKey`), `frontend/src/lib/api/mock/data.ts` (`SHEET_SECTION`).
> **Backend revisado:** `src/call_audit/ingestion/import_bench.py` (`product_sheet`, `input_data`, `Unmasker`), `src/call_audit/ingestion/pipeline.py` (`complete_row`), `src/call_audit/persistence/models.py` (`call_metadata`, `product_sheets`), `rubrics/bancoestado_retention/v1.0.1.yaml`.
> **No contradice:**
> - D-24: el veredicto y el comentario del cliente no aparecen. ESTADO_CALIDAD, COMENTARIO y las columnas de motivos quedan fuera de la ficha.
> - La anonimización antes del LLM no cambia, y estos datos no entran al modelo.
> - El Cambio 12 (admin en solo lectura) tampoco cambia.

---

## 0. Decisiones

| # | Decisión | Origen |
|---|---|---|
| D-41 | Nada se enmascara, tampoco la cuenta de cargo. No hay botón "Mostrar" | Johannes |
| D-42 | Se agrega un bloque **"Ficha del cliente"** dentro de la sección Ficha del seguro, **arriba de las pestañas de seguros**, porque es uno por llamada | Johannes ("una parte que diga ficha del cliente"); ubicación propuesta por el diseñador |
| D-43 | **Campos.** Bloque Ficha del cliente: nombre completo, RUT con DV, fecha de nacimiento, email, teléfono y flujo. En cada pestaña de seguro: compañía, tipo de seguro, fecha de venta, cuenta de cargo y renunciable/retenible según la metadata, con aviso si no coincide con la categoría de la ficha. Sin ID de gestión | Johannes (P1 A) |
| D-44 | Lo ven el auditor, el supervisor y el admin Qubico (este último en solo lectura). No depende de permisos extra | Johannes (P2 A) |
| D-45 | No se registra quién abre la llamada ni quién ve los datos | Johannes (P3 B) |
| D-46 | Se guardan solo los campos de D-43, vinculados a la llamada. Se borran con la llamada y no van a logs, a exportaciones ni al panel del modelo. Las llamadas actuales se reimportan **solo con su metadata**, sin correr IA | Johannes (P4 A) |

**Por qué (trazabilidad).** Los motivos 31 ("No valida correctamente al cliente (RUT, nombre, fecha de nacimiento)") y 33 ("… (email, fono)") solo se pueden auditar si se compara lo que el ejecutivo validó en la llamada con los datos reales. Hoy la transcripción sin enmascarar muestra lo que se dijo, pero la app no tiene contra qué compararlo. Renunciable y retenible apoyan a los motivos 9, 14 y 17 (sección `category`). Compañía, tipo y fecha de venta ayudan a confirmar que la ficha corresponde al seguro de la llamada (motivos 2 y 6).
- **R-13.1** Datos de identidad visibles junto a la transcripción mientras se revisan los motivos 31 y 33.
- **R-13.2** Comparación explícita entre lo que dice la metadata y lo que dice la ficha del catálogo sobre si el seguro es renunciable o retenible.

---

## 1. Estructura

```
Ficha del seguro                                   [plegar]
┌ Ficha del cliente  ▾            (Relevante para el motivo 31)
│ Vienen de la metadata de la llamada.
│ Nombre               María José Pérez Soto
│ RUT                  12.345.678-5
│ Fecha de nacimiento  04-03-1981
│ Email                mj.perez@ejemplo.cl
│ Teléfono             +56 9 1234 5678
│ Flujo                {valor de FLUJO}
└
[Seguro 1 · Desempleo …] [Seguro 2 · …]           ← pestañas existentes
Ficha v3
Datos de la llamada
  Vienen de la metadata de la llamada.
  Seguro · Plan · Prima · … (lo que ya existe)
  Compañía · Tipo de seguro · Fecha de venta · Cuenta de cargo   ← nuevos
Categoría
  Compañía · Categoría · Regla                      (catálogo, sin cambios)
  Renunciable según la metadata   Sí               ← nuevos
  Retenible según la metadata     No
  ⚠ Aviso de discrepancia (si aplica)
Prima · Devolución · Retracto · Coberturas · …     (sin cambios)
```

- **Mismo contenido en los dos contenedores:** la columna (`ProductSheetColumn`, xl) y el drawer (`Sheet` en pantallas angostas). Los dos usan `ProductSheetContent`, así que el bloque se agrega ahí.
- **Plegable** con `<details>`, igual que Coberturas: abierto por defecto. Cuando el ítem en foco es el 31 o el 33, se abre a la fuerza y se resalta (mismo patrón que `hl("coverages")`, con `key` para reabrirlo).
- **Va aunque no haya seguro identificado.** Hoy `ProductSheetContent` corta en "Esta llamada no tiene un seguro identificado en el catálogo." cuando `sheets` viene vacío. La Ficha del cliente se muestra igual arriba de ese mensaje.
- El título de la columna y del drawer sigue siendo "Ficha del seguro" (D-42).
- Renunciable y retenible van en la sección **Categoría**, no en Datos de la llamada, para que queden junto a la categoría del catálogo con la que se comparan. Así también se resaltan con los motivos 9, 14 y 17 sin crear otra clave.

### 1.1 Formato de los valores

| Campo | Fuente | Formato |
|---|---|---|
| Nombre | NOMBRE + PATERNO + MATENRO (aceptar también MATERNO, H-76) | Concatenado con espacios simples, sin vacíos. Se muestra como viene, sin cambiar mayúsculas: los nombres tienen excepciones |
| RUT | RUT + DV | `12.345.678-5`: puntos de miles, guion y DV en mayúscula |
| Fecha de nacimiento | FECHA_NACIMIENTO | `dd-mm-aaaa` |
| Email | EMAIL | Como viene, en minúsculas |
| Teléfono | FONO_CONTACTO | Con 9 dígitos móviles: `+56 9 1234 5678`. En otro caso, como viene |
| Flujo | FLUJO | Como viene |
| Compañía | COMPAÑIA | Como viene |
| Tipo de seguro | TIPO_SEGURO | Como viene |
| Fecha de venta | FECHA_VENTA_SEGURO | `dd-mm-aaaa` |
| Cuenta de cargo | CUENTA_DE_CARGO | Completa, como viene (D-41) |
| Renunciable / Retenible según la metadata | RENUNCIABLE / RETENIBLE | `Sí` / `No` cuando el valor se reconoce (SI, S, 1, TRUE…). Si no, como viene (H-74) |

Si un valor no parsea (fecha o RUT inválidos), se muestra **tal como viene**. No se oculta ni se "corrige".

### 1.2 Regla de discrepancia (determinística, en el backend)

Correspondencia de la categoría del catálogo (las 6 reales, H4 del Cambio 11):

| Categoría de la ficha | Renunciable esperado | Retenible esperado |
|---|---|---|
| `RETENIBLE` | Sí | Sí |
| `NO_RETENIBLE` | Sí | No |
| `NO_RENUNCIABLE_*` (4) | No | (no se compara) |

Hay discrepancia si un valor de la metadata que se reconoce como Sí/No contradice lo esperado. Si la metadata no trae el dato, si no se reconoce, o si la llamada no tiene ficha, no se muestra aviso (H-77). **No cambia el veredicto ni la decisión:** es información para la persona que revisa.

---

## 2. Estados

| Estado | Qué se ve |
|---|---|
| Normal | Bloque abierto con los 6 campos |
| Falta un campo (p. ej. EMAIL en 3/100) | El valor dice "No viene en la metadata", en texto secundario (`text-muted-foreground`) |
| La llamada no trae datos del cliente (fila sin esas columnas, o lote que aún no se reimporta) | Bloque con el texto "Esta llamada no trae datos del cliente en la metadata." |
| Foco en el motivo 31 o 33 | Bloque abierto, borde `primary` y fondo `accent`, con el badge "Relevante para el motivo 31" (o 33) |
| Foco en el motivo 9, 14 o 17 | Se resalta la sección Categoría, como hoy, que ahora incluye las filas de la metadata y el aviso |
| Discrepancia | Aviso dentro de Categoría, en esa pestaña |
| Sin seguro identificado | Ficha del cliente y, debajo, el mensaje que ya existe |
| Cargando / error | Lo de siempre en el detalle de la llamada: el bloque llega en la misma respuesta, sin carga propia |
| Admin Qubico (solo lectura) | Igual que el auditor. El bloque no tiene acciones |

---

## 3. Microcopy

| Elemento | Texto |
|---|---|
| Título del bloque | Ficha del cliente |
| Ayuda del bloque y de "Datos de la llamada" | Vienen de la metadata de la llamada. |
| Etiquetas | Nombre · RUT · Fecha de nacimiento · Email · Teléfono · Flujo |
| Nuevas filas de Datos de la llamada | Compañía · Tipo de seguro · Fecha de venta · Cuenta de cargo |
| Nuevas filas de Categoría | Renunciable según la metadata · Retenible según la metadata |
| Campo faltante | No viene en la metadata |
| Sin datos | Esta llamada no trae datos del cliente en la metadata. |
| Badge | Relevante para el motivo {n} (el texto que ya existe) |
| Aviso de discrepancia | La metadata y la ficha no coinciden: la metadata dice «{Renunciable: No}» y la ficha dice «{categoría}». Revisa cuál corresponde antes de decidir el motivo. |

En el aviso se nombra **solo el campo que discrepa**. Si discrepan los dos: «Renunciable: Sí · Retenible: Sí».

**Glosario:**
- "Ficha del cliente": datos de la persona según la metadata.
- "Ficha del seguro": catálogo.
- "Metadata": el Excel o archivo que llega con el lote. Es el término de Johannes; no se usa "base del cliente", porque se confunde con el cliente BancoEstado.
- En el código, el titular de la póliza es **`customer`** y no `client`, porque `clientId` ya es la empresa cliente (Cambio 12).

---

## 4. Accesibilidad (WCAG 2.2 AA)

- El bloque es una `<section aria-labelledby>`. El título va en el `<summary>` como texto, no solo en negrita. Los datos van en `<dl>`/`<dt>`/`<dd>`, como el resto de la ficha (1.3.1).
- El resaltado no depende solo del color: lleva el badge con texto (1.4.1). Usa los tokens actuales, con contraste ya validado en la Fase 8 (1.4.3, 1.4.11).
- El aviso de discrepancia lleva un ícono `aria-hidden` y un texto completo que empieza con "La metadata y la ficha no coinciden". Es estático: no usa `role="alert"`, porque no aparece por una acción del usuario.
- Los emails y las cuentas largas se cortan con `overflow-wrap: anywhere`. No hay scroll horizontal en el drawer ni en la columna a 320 px (1.4.10).
- El `<summary>` se puede usar con teclado y tiene foco visible con el estilo existente (2.4.7). Abrirlo a la fuerza por el foco no mueve el foco del teclado.
- Los valores son texto seleccionable, para copiarlos o buscarlos en la transcripción.

---

## 5. Revisión rápida

| Chequeo | Resultado |
|---|---|
| Trazabilidad | R-13.1 → motivos 31 y 33. R-13.2 → motivos 9, 14 y 17. Compañía, tipo y fecha de venta → motivos 2 y 6 |
| Patrones y navegación | Reutiliza `Section`, `<details>` y el resaltado por `productSheetSection`. No agrega navegación |
| Roles | D-44: los tres roles, sin permiso nuevo. D-24 se respeta: ESTADO_CALIDAD, COMENTARIO y los motivos del cliente no se tocan |
| Panel del modelo (`view_model_io`) | **No** agregar estos datos a `input_data`: el modelo nunca los recibió, y mostrarlos ahí falsearía la trazabilidad |
| Dark patterns | No aplica |
| Microcopy | §3, coherente con 06 §3.4 |

---

## 6. Handoff · cambios de datos y backend

**Importación (`real_calls.build_call` / `pipeline.complete_row` / `import_bench`)**
1. Guardar `call_metadata["customer"] = {full_name, rut, birth_date, email, phone, flow}`. Los valores van normalizados según §1.1 o crudos si no parsean; los ausentes, `null`.
2. Agregar a cada póliza de `call_metadata["policies"]` los campos `insurer`, `insurance_type`, `sale_date`, `charge_account`, `renounceable` y `retainable`. Cada póliza toma los suyos de la fila de su seguro (H-75).
3. `complete_row`: `setdefault` de las columnas nuevas. MATENRO o MATERNO, lo que venga (H-76).
4. Nada de estos valores en logs, mensajes de error ni nombres de archivo. Se loguea `call_id`.

**Respuesta del detalle de llamada**
5. Nuevo campo en el nivel de la llamada: `customer: { fullName, rut, birthDate, email, phone, flow } | null`. Cada campo es `string | null`, y `null` se muestra como "No viene en la metadata". Si la llamada no trae ningún campo, `customer` es `null` y se muestra el estado "Sin datos".
6. `ProductSheet.callData`: se suman las filas Compañía, Tipo de seguro, Fecha de venta y Cuenta de cargo (en `product_sheet()` de `import_bench.py`, misma lista `label/key`).
7. `ProductSheet` suma `customerCategory: { renounceable: string | null, retainable: string | null } | null` y `categoryMismatch: { field: "renounceable" | "retainable", metadata: string }[]`, calculado con la regla de §1.2 en el backend.
8. En `types.ts`, el comentario de `callData` ("enmascarados") queda obsoleto: cambiarlo a "de la metadata".

**Resaltado**
9. `ProductSheetSectionKey` suma `"customer"`. M31 y M33 → `customer`. Hoy el mapeo vive en la rúbrica (`product_sheet_section`), y las versiones publicadas son inmutables. Hay que decidir en implementación cómo llega el mapeo (H-78, ver §7).

**Frontend**
10. En `ProductSheetContent`, el bloque va antes del `return` temprano por `!sheets.length`. Recibe `customer` y `relevant`. En `call-detail.tsx` se pasa `data.customer` a la columna y al drawer.
11. Mock (`mock/data.ts`): solo valores **sintéticos** (L-19). Se agrega un caso con email faltante, uno con discrepancia y uno sin `customer`.

**Reimportación (D-46)**
12. Un comando idempotente que vuelve a leer la metadata de los lotes ya importados y actualiza `call_metadata.customer`, las pólizas y `product_sheets`, **sin transcribir ni llamar al LLM**. No toca validaciones, revisiones ni versiones de ficha o rúbrica.

**Tests (pytest)**
- Normalización de §1.1, incluidos los valores inválidos que se muestran crudos.
- Regla de discrepancia de §1.2 con las 6 categorías y con valores no reconocidos.
- `input_data` no incluye `customer`.
- La respuesta del detalle no incluye ESTADO_CALIDAD ni COMENTARIO para ningún rol.

---

## 7. Hipótesis y gates

- **H-74** RENUNCIABLE/RETENIBLE traen SI/NO o equivalentes. No se leyeron valores, solo encabezados.
- **H-75** Los campos por seguro vienen en la fila de cada póliza (una fila por seguro).
- **H-76** La columna MATENRO puede venir corregida como MATERNO en otros lotes.
- **H-77** Correspondencia categoría ↔ renunciable/retenible de §1.2. Hay que confirmarla con el cliente o con `rubric-engineer`.
- **H-78** Cómo llega `product_sheet_section: customer` para M31 y M33: una rúbrica nueva (v1.0.2) o un mapeo de presentación fuera de la rúbrica (H-32). Con v1.0.2, las llamadas validadas con v1.0.1 no tendrían el resaltado salvo que el detalle lea el mapeo vigente. Es una decisión técnica (`rubric-engineer` / `pipeline-architect`), no de UX. El resto del cambio se implementa igual.

**Gates:** no queda ninguno de UX abierto. H-78 es técnico y no bloquea.
