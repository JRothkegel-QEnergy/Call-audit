# 11 · Ficha completa del seguro (pedido 2026-11-13)

Tipo: ajuste acotado a una pantalla ya aprobada e implementada (`07-ficha-en-caso.md`, C1-C4; y el detalle de llamada del auditor, que usa el mismo componente). Un solo gate (K1-K6). Sin código de UI hasta aprobar.

## 1. Pedido

Johannes: "Para este caso, viendo la ficha del seguro, no veo en ningún lado que cubra examen preventivo de ningún tipo, en caso de que no se muestre toda la información de la ficha ahí a la izquierda debería haber un botón que diga ver más y aparezca un modal con el detalle total."

Caso: «SEGURO COBERTURA ONCOLOGICA Y MUERTE ACCIDENTAL» (SONAP), motivo 6 «No maneja información del producto o coberturas». La IA dice que la ejecutiva afirmó que el examen preventivo de colon es colonoscopía, y que la ficha estipula «sangre oculta en deposiciones». El revisor no encuentra ese dato en la ficha, así que no puede verificar a la IA.

Pantallas: `/admin/prompts/[version]/calls/[caseId]` (`case-review.tsx`) y `calls/[id]` (`call-detail.tsx`). Componente: `components/call/product-sheet.tsx`.

## 2. Lo que hay hoy (leído en el código)

| Capa | Estado |
|---|---|
| Catálogo (`data/catalog/products.json`, `CatalogProduct` v1.1.0) | Tiene el dato. P01-P03 SONAP: 8 asistencias, entre ellas «Examen de cáncer de colon — sangre oculta en deposiciones. Requiere orden médica. 1 por año». También notas, fono de asistencias, capital, edades, plazos, inicio de cobertura, apoyo solidario, primas por tramo, siniestros, exclusiones, observaciones, tasas y edades por plazo de crédito, información adicional, pólizas, detalle de categoría |
| `product_sheet()` (`ingestion/import_bench.py:155`) | Solo pasa nombre, aseguradora, datos de la llamada, categoría, regla, tipo de prima, devolución, retracto y coberturas. El resto se pierde |
| Front (`ProductSheetContent`) | Muestra lo anterior. La última sección «Asistencias · Primas · Siniestros · Observaciones» es un placeholder vacío («Detalle del catálogo.») |
| Resaltado | Motivos 2, 4 y 6 apuntan a `coverages` en la pauta; solo resalta «Coberturas» |
| Componentes UI | `Dialog` (Radix, Esc y clic afuera cierran, `width` configurable, exige `footer`) y `Sheet` lateral. Los atajos 1-4, J/K, N ya se bloquean con un `role=dialog` abierto |

Problema de fondo (P-K1): **la IA ve una ficha más completa que el revisor**. Cualquier motivo de producto (2, 4, 6) puede citar datos que el revisor no tiene en pantalla.

## 3. Propuesta

### 3.1 Datos (backend)

`product_sheet()` agrega un bloque `detail` con todo el catálogo del producto en la misma versión de ficha que vio la IA, ya ordenado y rotulado con `LABELS` de `schema.py` (un solo lugar para los nombres en español). Forma: lista de secciones `{key, title, rows | table | text}`; las vacías no se envían. El front lo pinta de forma genérica, así un campo nuevo del catálogo aparece sin tocar el front.

### 3.2 Columna (resumen)

- La sección placeholder se reemplaza por **«Asistencias»**, con el mismo formato que «Coberturas» (nombre y detalle; eventos y tope en una línea gris si existen). Plegada por defecto; **abierta y resaltada junto con Coberturas** cuando el motivo en foco es de coberturas (2, 4, 6), con la insignia «Relevante para el motivo N».
- Si el producto no tiene asistencias, la sección no aparece.
- Al final de la columna, botón secundario de ancho completo **«Ver ficha completa»** (icono `Maximize2`). El mismo botón, solo icono con `aria-label="Ver ficha completa"`, va en el encabezado de la columna junto a «Plegar ficha», para no tener que bajar. En el `Sheet` lateral (bajo `2xl`) aparece igual.

### 3.3 Modal «Ficha completa»

- `Dialog` ancho (`width` 880; a ancho de teléfono ocupa la pantalla menos 16 px por lado). Título: «{nombre del seguro}»; descripción: «{aseguradora} · Ficha v{N}» y el aviso de versión más nueva si aplica (mismo texto que la columna). Footer: «Cerrar».
- Si la llamada tiene varios seguros, pestañas «Seguro 1 · …» arriba; abre en la pestaña activa de la columna.
- **Índice** de secciones (enlaces ancla) en una columna izquierda angosta desde `md`; bajo `md`, una fila de chips que se desplaza horizontalmente dentro del modal.
- Todas las secciones **desplegadas** (no acordeones): así el revisor lee de corrido y el buscar del navegador (Ctrl+F) encuentra el texto.
- Orden (secciones vacías ocultas):

| # | Sección | Campos | Formato |
|---|---|---|---|
| 1 | Resumen | categoría y detalle, tipo y modalidad de prima, capital asegurado, edades de ingreso y permanencia, inicio de cobertura, devolución de prima, retracto | filas etiqueta/valor |
| 2 | Coberturas | nombre, monto, detalle, beneficiario | lista como en la columna |
| 3 | Asistencias | nombre, detalle, eventos, tope, fono; fono de asistencias general arriba | tabla (`<table>` con encabezados); bajo `md`, tarjetas apiladas |
| 4 | Exclusiones | | lista |
| 5 | Primas por plan | plan, asegurado, tramo de edad, monto, prima UF, prima CLP, periodicidad, póliza/tabla | tabla con scroll horizontal propio (no de la página), primera columna fija |
| 6 | Siniestros | cobertura, plazo, canal, documentos, plazo de cobertura; plazo para denunciar y apoyo solidario arriba | tabla / tarjetas bajo `md` |
| 7 | Crédito | tasas por plazo, edad máxima por plazo, incapacidad temporal | tablas (solo productos de crédito) |
| 8 | Notas y observaciones | notas, observaciones, información adicional | texto |
| 9 | Identificación | nombres en sistema, descripción, canales, N° de póliza y nota | filas |

- **Resaltado**: el modal abre desplazado a la primera sección relevante para el motivo en foco, con borde e insignia «Relevante para el motivo N» (mismo estilo que la columna). Motivos 2, 4, 6 → Coberturas, Asistencias y Exclusiones; el resto según `productSheetSection` de la pauta (`premium` → Primas, `refund`/`withdrawal`/`category` → Resumen). El índice marca las secciones relevantes con un punto y texto oculto «relevante».
- Atajos: ninguno nuevo. El `Dialog` bloquea 1-4, J/K, N mientras está abierto; Esc cierra y el foco vuelve al botón que lo abrió.

### 3.4 Trazabilidad

P-K1 (revisor sin el dato que cita la IA) → R-14..R-18 (verificar el 27 % con evidencia), O-04 (revisar caso a caso). Aplica igual al auditor (D-41: la ficha sin enmascarar).

## 4. Revisión rápida

| Revisión | Resultado |
|---|---|
| Patrones y navegación | `Dialog` existente + índice con anclas; tablas con encabezados reales. Sin navegación nueva |
| Accesibilidad | Foco atrapado y devuelto (Radix); botón solo icono con `aria-label`; tablas con `<th scope>`; scroll horizontal de Primas accesible por teclado (`tabindex=0` + `aria-label`); resaltado con insignia de texto, no solo color; objetivos táctiles >= 24 px |
| Microcopy | Nuevos: «Ver ficha completa», «Asistencias», «Fono de asistencias», «Ficha completa» no se usa como título (va el nombre del seguro). Rótulos de campos = `LABELS` del catálogo. Glosario sin cambios |
| Densidad | La columna crece con «Asistencias» (8 ítems en SONAP); por eso va plegada salvo con motivos de coberturas |
| Coherencia | Columna y modal salen del mismo `detail`; lo que ve el revisor es lo que vio la IA (misma versión) |

## 5. Supuestos

- **H-K1 [SUPUESTO]**: la IA recibe en el prompt las asistencias y el resto del catálogo (lo sugiere que cite «sangre oculta en deposiciones»). Se confirma al implementar mirando el armado del prompt; si recibe menos, el modal igual muestra todo pero se anota la diferencia.
- **H-K2 [SUPUESTO]**: con todo desplegado más Ctrl+F alcanza para encontrar un dato; un buscador propio no hace falta en esta entrega.
- **H-K3 [SUPUESTO]**: 880 px de ancho bastan para la tabla de primas de los productos actuales; si no, la tabla hace scroll dentro de su caja.

## 6. Decisiones (K1-K6)

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| K1 | Dónde va el botón | **A** «Ver ficha completa» al final de la columna (reemplaza el placeholder) + icono en el encabezado de la columna · B solo al final · C solo en el encabezado | **A** |
| K2 | Asistencias en la columna | **A** siempre como sección propia, plegada, abierta y resaltada con motivos de coberturas (2, 4, 6) · B solo cuando el motivo en foco es de coberturas · C no van en la columna, solo en el modal | **A** |
| K3 | Contenido y orden del modal | **A** las 9 secciones de §3.3, vacías ocultas, todo desplegado, con índice · B volcado plano en el orden del esquema, sin índice · C acordeones plegados | **A** |
| K4 | Resaltado en el modal | **A** abre en la sección relevante para el motivo en foco, con insignia (2, 4, 6 → Coberturas, Asistencias, Exclusiones) · B abre arriba, sin resaltado | **A** |
| K5 | Buscador dentro del modal | **A** no; Ctrl+F del navegador (todo desplegado) · B campo «Buscar en la ficha» que filtra y resalta coincidencias | **A** (revisar después si se usa mucho) |
| K6 | Forma de los datos | **A** `product_sheet()` envía `detail` genérico (secciones ya rotuladas con `LABELS`, misma versión de ficha que la IA) · B tipar cada campo del catálogo en `types.ts` | **A** |

Esperando aprobación de K1-K6.
