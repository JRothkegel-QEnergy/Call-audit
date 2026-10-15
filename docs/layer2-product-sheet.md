# Ficha estándar del seguro · Capa 2

**Versión 1.0** (2026-10-13).

Plantilla que se completa con el catálogo de seguros (`data/catalog/products.json`, generado desde el Excel "Apoyo_Seguros_estandarizado.xlsx" con `scripts/prompt_bench/extract_catalog.py`) y se inserta en el mensaje de usuario del prompt de la capa 2 (`docs/layer2-prompt-example.md`), una vez por cada seguro que viene en los metadatos de la llamada.

Así el system prompt queda fijo (se cachea) y la información de cada producto cambia según la llamada.

- El match es por "Nombre en sistema" (sin tildes ni mayúsculas).
- Los campos sin dato se omiten. Las secciones vacías dicen "sin dato en el catálogo".
- Los seguros no retenibles y no renunciables no tienen ficha: se usa la plantilla corta.
- Lo que está entre `{ }` lo completa `scripts/prompt_bench/render.py`.

## Plantilla con ficha (seguros retenibles)

```text
### Seguro {n}: {nombre_sistema}
Datos de la llamada (BancoEstado):
- N° de seguro (MUS A Neto): {mus_a_neto}
- N° de póliza: {n_poliza}
- inicio de vigencia: {inicio_vigencia}
- medio de pago: {medio_pago}{datos_contrato}

Ficha del producto ({id_producto}: {nombre_real}):
- compañía: {compania}
- categoría: {categoria}. {regla_categoria}
- tipo de prima: {tipo_prima}. Modalidad: {modalidad_prima}
- devolución de prima al renunciar: {regla_devolucion}
- retracto: {retracto}
{datos_generales}
Coberturas:
{coberturas}
Asistencias y beneficios:
{asistencias}
Primas:
{primas}
{tabla_incapacidad}Siniestros (cómo usar el seguro):
{siniestros}
{observaciones}
```

## Plantilla sin ficha (no retenibles y no renunciables)

```text
### Seguro {n}: {nombre_sistema}
Datos de la llamada (BancoEstado):
- N° de seguro (MUS A Neto): {mus_a_neto}
- N° de póliza: {n_poliza}
- inicio de vigencia: {inicio_vigencia}
- medio de pago: {medio_pago}{datos_contrato}

Ficha del producto: no hay ficha en el catálogo para este seguro.
- nombre real: {nombre_real}
- compañía: {compania}
- categoría: {categoria}. {regla_categoria}
```

## Reglas por categoría

Texto de `{regla_categoria}`:

| Categoría | Regla |
|---|---|
| RETENIBLE | Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo. |
| NO_RETENIBLE | Se puede renunciar, pero no se debe intentar retener (motivo 17). |
| NO_RENUNCIABLE_SUCURSAL | No se puede renunciar por teléfono; solo se reemplaza por otra póliza en sucursal. Se registra como consulta. |
| NO_RENUNCIABLE_COSTO_BANCO | Lo paga el banco, no tiene costo para el cliente. No se hace ninguna gestión. |
| NO_RENUNCIABLE_SUBSIDIADO | Subsidiado MINVU, obligatorio. No se puede renunciar; el cliente no paga o paga solo una parte. |
| NO_RENUNCIABLE_OBLIGATORIO | Obligatorio (SOAP). No se renuncia ni se reemplaza; si el cliente insiste, que llame a la compañía. |

## Historial de cambios

**1.0 (2026-10-13)**: primera versión, desde el Excel estandarizado. Reemplaza el volcado de la hoja completa del Excel de apoyo que usaba el prompt 2.x.
