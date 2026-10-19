# Prompt de ejemplo · Capa 2 · Auditoría de llamadas de retención

> **Nota de implementación:** este es el prompt de referencia del dominio (en español, porque las llamadas son en español). Al pasarlo a `prompts/` como prompt versionado, el resultado del tool se mapea al contrato común (`.claude/rules/layer-contract.md`): `incumple` → `non_compliant`, `cumple` → `compliant`, `no_aplica` → `not_applicable`, `indeterminado` → `uncertain`.

La versión vigente del prompt está en `prompts/layer2/prompt.yaml` (campo `version`); el historial, en `prompts/layer2/CHANGELOG.md`.

Fuentes:

- **Pauta de Calidad Actualizada** (33 motivos, texto oficial) con las **notas de la reunión de revisión** del 2026-10-09 (columna "Notas" del Excel).
- **Resumen y minuta de la reunión** "Revisión pauta retenciones" (2026-10-09).
- **Apoyo nuevo v1** (Excel del cliente): catálogo de seguros retenibles, no retenibles y no renunciables, fichas de cada producto, medios de pago y procedimientos (hoja Otros). Se extrae con `scripts/prompt_bench/extract_catalog.py`.
- **Script Retención BECS (julio 2026)**: protocolos de saludo, validación, retención, renuncia, solicitudes y cierre. Cuando contradice al Excel de apoyo, manda el script (es más nuevo y es el guion del ejecutivo).
- **Motivos de Renuncia** (27).

El prompt tiene 3 partes, más una plantilla:

1. **System prompt**: fijo por protocolo; se cachea en el batch.
2. **Mensaje de usuario**: cambia en cada llamada; lleva los metadatos, los seguros con su ficha y la transcripción.
3. **Esquema de salida**: tool con JSON forzado.
4. **Ficha estándar del seguro** (`docs/layer2-product-sheet.md`): plantilla que se completa con el catálogo según el seguro de los metadatos y se inserta en el mensaje de usuario.

Lo que está entre `{{ }}` lo completa el sistema. Lo marcado con **[DEFINIR]** debe confirmarlo el cliente.

---

## 1. System prompt

Vive en **`prompts/layer2/prompt.yaml`**, partido en secciones e ítems (reglas, definiciones y los 33 motivos). Cada ítem lleva su historial con el **origen** de cada cambio (texto oficial, feedback del cliente, script, catálogo, feedback de validación o diseño nuestro) y, en los motivos, el texto oficial separado de la aclaración (`Criterio:`).

- Prompt armado, para leerlo entero: `prompts/layer2/system.txt` (generado).
- Qué reglas vienen de feedback, cuáles personalizan la pauta y qué está pendiente: `prompts/layer2/PROVENANCE.md` (generado).
- Cómo sacar una versión nueva: `prompts/layer2/README.md`.

---

## 2. Mensaje de usuario (por llamada)

```text
## Metadatos
llamada_id: {{llamada_id}}
fecha: {{fecha}}
ejecutivo: {{ejecutivo_id}}
duracion_seg: {{duracion}}
esperas_seg: {{lista_de_esperas}}        # ej. [45, 130]
umbral_espera_seg: 30

## Seguros del cliente consultados en la llamada
{{#seguros}}
{{ficha_estandar}}        # plantilla de docs/layer2-product-sheet.md, una por seguro
{{/seguros}}

## Tipificación registrada por el ejecutivo
{{#tipificaciones}}
- seguro: {{mus_a_neto}} | gestion: {{RENUNCIA/RETENCION/CONSULTA}} | motivo: {{motivo}}
{{/tipificaciones}}

## Transcripción (canal separado, timestamps mm:ss, datos personales enmascarados)
{{transcripcion}}
```

**Ejemplo de un seguro** (plantilla de `docs/layer2-product-sheet.md` completada con `data/catalog/products.json`, recortada):

```text
### Seguro 1: DESEMPLEO ITT CRE. CONSUMO
Datos de la llamada (BancoEstado):
- N° de seguro (MUS A Neto): 48213301
- N° de póliza: 498213301
- inicio de vigencia: 2025-03-15
- medio de pago: CRE (Crédito de Consumo (Está asociado a un crédito de consumo))

Ficha del producto (P30: Desempleo e Incapacidad Temporal – Créditos de Consumo):
- compañía: BNP Paribas Cardif
- categoría: RETENIBLE. Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.
- tipo de prima: prima única asociada a un crédito (cobro anticipado). Modalidad: Prima única y anticipada (según plazo y monto del crédito)
- devolución de prima al renunciar: corresponde devolución automática de la prima no devengada, en 10 días hábiles desde que la compañía toma conocimiento.
- capital asegurado: Hasta 4 cuotas del crédito + 3,5% gastos administrativos
Coberturas:
- Desempleo involuntario. monto: Hasta 4 cuotas + 3,5%. ...
```

---

## 3. Esquema de salida (tool forzada)

En **`prompts/layer2/schema.json`** (herramienta `registrar_auditoria`). Se versiona junto con el prompt: un cambio del esquema también sube la versión.

---

## 4. Ejemplo de salida (llamada ficticia, recortada)

```json
{
  "resumen": "La clienta llama para renunciar al seguro de desempleo por problemas económicos. El ejecutivo argumenta 5 veces pese a sus negativas tajantes y finalmente procesa la renuncia, pero no indica el N° de seguro en el cierre.",
  "intencion_renuncia": {
    "expresada": true,
    "cita": "Quiero renunciar al seguro de desempleo.",
    "timestamp": "00:41"
  },
  "termino_llamada": {
    "tipo": "NORMAL",
    "comentario": "Despedida y fin de la llamada."
  },
  "gestiones": [
    {
      "mus_a_neto": "48213302",
      "resultado_grabacion": "RENUNCIA",
      "motivos_renuncia": ["Problemas Económicos", "No desea contraer más obligaciones"],
      "n_objeciones": 5,
      "cliente_tajante": true,
      "argumentos_retencion": [
        {"t": "00:52", "tipo": "COBERTURA", "cita": "le paga cuatro cuotas de su crédito si queda cesante"},
        {"t": "01:15", "tipo": "BENEFICIO", "cita": "la prima ya está pagada, no le cobran todos los meses"}
      ],
      "evidencia": "00:52–01:50: cinco argumentos de retención tras negativas"
    }
  ],
  "criterios": [
    {
      "id": 3,
      "mus_a_neto": "48213302",
      "comentario": "5 argumentos de retención tras la solicitud y las negativas tajantes de la clienta; el máximo es 3.",
      "evidencia": [
        {"t": "01:31", "hablante": "CLIENTE", "cita": "Oiga, ya le dije tres veces que no."},
        {"t": "01:36", "hablante": "AGENTE", "cita": "¿Y si lo mantiene un mes más y después lo vemos?"}
      ],
      "estado": "incumple",
      "confianza": 0.9
    },
    {
      "id": 13,
      "mus_a_neto": "48213302",
      "comentario": "Cierre 01:50–02:05: confirma la renuncia y el medio de pago, pero no menciona el N° de seguro.",
      "evidencia": [],
      "estado": "incumple",
      "confianza": 0.85
    },
    {
      "id": 27,
      "comentario": "No interviene un tercero.",
      "estado": "no_aplica",
      "confianza": 0.95
    }
  ]
}
```

---

## Notas para la implementación

- **Catálogo de seguros:** `scripts/prompt_bench/extract_catalog.py` lee el Excel de apoyo y escribe `data/catalog/products.json` (fuera del repo). De ahí salen la categoría, el tipo de prima, la ficha y los medios de pago de cada seguro. En producción, el catálogo debe ser configuración versionada, igual que la rúbrica.
- **Qué hace mejor la capa 1 (reglas):** los motivos 13 y 15 (N° de seguro y medio de pago en el cierre), 31 y 33 (preguntas de validación) y 1 (esperas y silencios > 30 s) se pueden revisar con regex, fuzzy matching y timestamps. El LLM queda como respaldo.
- **Tipificación (18–25):** el LLM extrae lo que pasó en la grabación (`gestiones`). La comparación con lo tipificado también la puede hacer el **motor de decisión** en código: para el 18 basta que el motivo tipificado esté en `motivos_renuncia`.
- **Orden de argumentos (dashboard):** el motor calcula desde `argumentos_retencion` si la fecha de renovación quedó al final. Es un indicador, no un motivo.
- **Validar las citas:** cada `cita` debe existir en la transcripción. Si no aparece, el criterio pasa a `indeterminado`.
- **Capa 1 con el script:** las frases fijas del script ("esta conversación está siendo grabada", "Número de Seguro terminado en", "¿Confirma que desea renunciar", "¿eso es un Sí?", "FonoSeguros") se pueden buscar con fuzzy matching.
- **Pendiente con el cliente [DEFINIR]:** la gravedad de cada motivo, el conteo de objeciones, qué motivo aplica cuando se tipifica RENUNCIA y la grabación es CONSULTA, qué significa exactamente "medio de pago otro", si no informar la devolución automática es motivo 28 o 29, y si el aviso de grabación del saludo se evalúa.

## Historial de cambios

En `prompts/layer2/CHANGELOG.md`. El origen de cada regla, en `prompts/layer2/PROVENANCE.md`.
