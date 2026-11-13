# 07 · Ficha del seguro en la revisión caso a caso (pedido 2026-11-13)

Tipo: ajuste acotado a una pantalla ya aprobada e implementada (`04-verificacion-propuesta.md`, V1-V5). Un solo gate (C1-C4). Sin código de UI hasta aprobar.

## 1. Pedido

Johannes: "Aquí deberíamos tener también la información del caso y de la persona a la derecha. Igual que en la vista del auditor."

Pantalla: `/admin/prompts/[version]/calls/[caseId]` (`case-review.tsx`).

## 2. Lo que hay hoy (leído en el código)

| | Revisión caso a caso (admin) | Detalle de llamada (auditor) |
|---|---|---|
| Columnas | `lg:grid-cols-[4fr_3.5fr]`: transcripción · «Por verificar (N)» | `grid-cols-[4fr_3.5fr]` y en `xl` `[4fr_3.5fr_2.5fr]` (o `44px` plegada): transcripción · pauta · ficha |
| Ficha | No hay | `ProductSheetColumn` (abierta por defecto, botón «Plegar ficha») en `xl`; bajo `xl`, botón «Ficha del seguro» que abre `ProductSheetContent` en un `Sheet` lateral |
| Datos | `api.getCase(caseId)` ya se pide (trae `productSheets` y `customer`) | idem |
| Resaltado | — | La sección relevante sigue al motivo en foco (`CUSTOMER_CRITERIA` 31/33 → Ficha del cliente; resto → `rubric.criteria[id].productSheetSection`) |

No hace falta backend nuevo. Para el resaltado, la revisión necesita la pauta (`loadRubric()`, ya existente y cacheada), que hoy no carga.

## 3. Propuesta

Copiar el patrón del auditor tal cual, para que la ficha se vea y se use igual en las dos pantallas (coherencia; el admin ya conoce la del auditor).

**Layout**
- `xl` (>= 1280 px): tres columnas `[4fr_3.5fr_2.5fr]` — transcripción · «Por verificar (N)» (+ «Coinciden con la planilla») · «Ficha del seguro». Plegada: `[4fr_3.5fr_44px]`.
- Entre `lg` y `xl`: se mantienen las dos columnas de hoy y aparece el botón «Ficha del seguro» (icono `PanelRight`) en la fila del encabezado, a la derecha de «Siguiente», que abre el panel lateral (`Sheet`) con el mismo contenido.
- Bajo `lg`: todo en una columna como hoy; el mismo botón y panel lateral.
- La columna de la ficha no es `sticky` (igual que en el auditor).

**Contenido**: el de `ProductSheetContent` sin cambios — Ficha del cliente (nombre, RUT, fecha de nacimiento, email, teléfono, flujo; «No viene en la metadata» si falta), pestañas por seguro, Datos de la llamada y ficha del producto.

**Resaltado**: la sección relevante sigue al motivo en foco de «Por verificar» (el borde azul de la tarjeta), con la insignia «Relevante para el motivo N». Al moverse con J/K o al clic en otra tarjeta, cambia el resaltado.

**Estado plegado**: abierta al entrar a cada caso; si se pliega, queda plegada al pasar con «Siguiente»/«Anterior» dentro de la misma sesión de revisión (estado en la página, no en `localStorage`; el admin recorre muchos casos seguidos y no debería tener que plegarla en cada uno).

**Atajos**: ninguno nuevo. Los de la página (1-4, J/K, N) no cambian; el `Sheet` ya bloquea los atajos porque abre un `role=dialog` (línea 176 de `case-review.tsx`).

**Trazabilidad**: O-04 (revisar caso a caso), R-14..R-18 de la reunión con el jefe (verificar el 27 % con evidencia); motivos 31 y 33 se verifican contra la Ficha del cliente, sin ella el admin no puede decidir si la IA o la planilla acertó.

## 4. Revisión rápida

| Revisión | Resultado |
|---|---|
| Patrones y navegación | Reutiliza patrón existente (columna plegable + `Sheet` bajo `xl`). Sin navegación nueva |
| Accesibilidad | Botón de plegar con `aria-label`; el `Sheet` atrapa el foco y cierra con Esc (componente existente). El resaltado no depende solo del color (insignia con texto). El foco inicial sigue en el `h1` |
| Microcopy | Se reutilizan «Ficha del seguro», «Ficha del cliente», «No viene en la metadata», «Relevante para el motivo N». Glosario sin cambios |
| Densidad | En `xl` la columna «Por verificar» se angosta (de ~47 % a ~35 % del ancho). Las tarjetas con el selector 2x2 caben en ~400 px a 1280; ver H-24 |

## 5. Supuestos

- **H-24 [SUPUESTO]**: a 1280 px las tarjetas de «Por verificar» (selector 2x2 + nota) se leen bien en la columna del medio. Si no, se sube el corte de tres columnas a `2xl` (1536 px). Se valida al implementar, en el navegador.
- **H-25 [SUPUESTO]**: el admin necesita la ficha sobre todo para los motivos 31/33 y los de condiciones del producto; por eso abierta por defecto.

## 6. Decisiones (C1-C4)

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| C1 | Layout | **A** tres columnas desde `xl` y botón + panel lateral bajo `xl` (igual que el auditor) · B tercera columna solo desde `2xl` · C ficha como bloque plegable bajo el encabezado | **A** |
| C2 | Abierta o plegada por defecto | **A** abierta al entrar; si se pliega, se mantiene plegada al pasar de caso · B siempre abierta en cada caso (como el auditor) · C plegada por defecto | **A** |
| C3 | Componente | **A** reutilizar `ProductSheetColumn` / `ProductSheetContent` tal cual, cargando la pauta para que el resaltado siga al motivo en foco · B igual pero sin resaltado (no carga la pauta) | **A** |
| C4 | Rol de solo lectura (`qubico_viewer`) | **A** la ve igual que el admin (es lectura, como el resto de la página) · B no la ve | **A** |

Esperando aprobación de C1-C4.
