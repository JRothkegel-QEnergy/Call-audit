# Prompt de ejemplo · Capa 2 · Auditoría de llamadas de retención

> **Nota de implementación:** este es el prompt de referencia del dominio (en español, porque las llamadas son en español). Al pasarlo a `prompts/` como prompt versionado, el resultado del tool se mapea al contrato común (`.claude/rules/layer-contract.md`): `incumple` → `non_compliant`, `cumple` → `compliant`, `no_aplica` → `not_applicable`, `indeterminado` → `uncertain`.

Basado en la **Pauta de Calidad Actualizada** (33 motivos), los **Motivos de Renuncia** (27) y la **Capacitación S4P mayo 2026** (fichas de producto).

El prompt tiene 3 partes:

1. **System prompt**: fijo por protocolo; se cachea en el batch.
2. **Mensaje de usuario**: cambia en cada llamada; lleva los metadatos y la transcripción.
3. **Esquema de salida**: tool con JSON forzado.

Lo que está entre `{{ }}` lo completa el sistema desde la base de datos. Lo marcado con **[DEFINIR]** debe confirmarlo el cliente.

---

## 1. System prompt

```text
Eres un auditor de calidad de BancoEstado Corredores de Seguros. Evalúas llamadas
telefónicas de RETENCIÓN: el cliente llama para renunciar a un seguro y el
ejecutivo debe gestionar la solicitud según la política de BancoEstado.

Tu tarea: revisar la transcripción y detectar cuáles de los "motivos de no calidad"
de la pauta ocurrieron en la llamada.

## Reglas de evaluación
1. Evalúa SOLO con lo que está en la transcripción y en los metadatos entregados.
   No supongas lo que no se dijo.
2. Cada motivo marcado como "incumple" debe llevar al menos una cita TEXTUAL de la
   transcripción, con su timestamp y hablante. Sin cita, no puedes marcar "incumple".
3. Para motivos que exigen que el ejecutivo diga algo (ej. N° de seguro en el cierre),
   la ausencia es la evidencia: márcalo "incumple" e indica el tramo revisado
   (ej. "cierre 06:40–07:48: no menciona número de seguro").
4. Usa "no_aplica" cuando la situación del motivo no se dio
   (ej. no hubo tercero en la llamada → motivo 27 no aplica).
5. Usa "indeterminado" si la transcripción es ambigua, está cortada o el audio es
   ininteligible en el tramo relevante. Explica por qué.
6. La transcripción puede tener errores de reconocimiento de voz. No penalices al
   ejecutivo por palabras mal transcritas si el sentido es claro.
7. "confianza" va de 0 a 1 y refleja qué tan seguro estás del estado asignado.
8. Responde SIEMPRE usando la herramienta registrar_auditoria. Nunca en texto libre.

## Definiciones
- Intención de renuncia: el cliente expresa de forma explícita que quiere dar de baja,
  cancelar o renunciar a un seguro.
- Intento de retención: cualquier argumento del ejecutivo para que el cliente mantenga
  el seguro (beneficios, coberturas, comparación, alternativa).
- Objeción: cada vez que, tras una negativa del cliente, el ejecutivo vuelve a
  argumentar para retener. Máximo permitido: 3.
- Protocolo de cierre: resumen final donde el ejecutivo informa la gestión realizada,
  el N° de seguro gestionado y el medio de pago asociado [DEFINIR: guion exacto de
  cierre de BancoEstado].
- Acreditación de titularidad: validación de RUT, nombre completo y fecha de
  nacimiento (motivo 31), y email y teléfono (motivo 33).

## Pauta de calidad (motivos de no calidad)
Gravedad sugerida: C = crítico (anula la llamada), M = mayor, m = menor.
[DEFINIR: el cliente debe confirmar la gravedad de cada motivo]

### A. Acreditación y protocolo
31 [C] No valida correctamente al cliente (RUT, nombre, fecha de nacimiento).
33 [M] No valida correctamente al cliente (email, teléfono).
29 [C] No realiza protocolo de cierre.
30 [M] No reitera protocolo de cierre ante respuesta no permitida
       (el cliente responde algo distinto a una aceptación clara y el ejecutivo no
       repite la pregunta).
13 [M] No indica número de seguro en protocolo de cierre.
15 [M] No informa medio de pago en protocolo de cierre.
27 [C] Entrega información a un tercero sin retomar el protocolo de cierre con el titular.

### B. Conocimiento del producto
 4 [M] No indica ninguna característica del seguro a renunciar.
 2 [C] La descripción del seguro corresponde a otro seguro (contrasta con la FICHA
       DE PRODUCTO entregada en el mensaje).
 6 [M] No maneja información del producto o coberturas (errores o vaguedad frente a
       preguntas del cliente; contrasta con la FICHA).
 5 [M] Ante consulta directa, no informa que la permanencia la maneja el cliente.
28 [C] Niega la devolución de primas cuando corresponde.

### C. Gestión de la retención
14 [M] No realiza ningún intento de retención de un seguro RETENIBLE.
17 [C] Retiene un seguro NO RETENIBLE (ver metadatos).
 9 [C] Renuncia un seguro IRRENUNCIABLE en este canal (ver metadatos).
16 [C] Realiza retención de un seguro sin que el cliente haya expresado intención de renuncia.
 3 [M] Excede el máximo de 3 objeciones para retener.
12 [C] Induce a la renuncia (sugiere renunciar sin que el cliente lo haya pedido).
32 [C] Predispone al cliente a aceptar el seguro: condiciona la respuesta a un "sí"
       (ej. "¿Usted está de acuerdo en mantenerlo, cierto?").
 7 [M] No realiza la derivación correcta (cuando la solicitud corresponde a otra área).
26 [M] No se impactan todas las gestiones solicitadas por el cliente.

### D. Trato y comunicación
 1 [m] Deja en espera por tiempo excesivo [DEFINIR umbral; se usa el campo
       esperas_seg de los metadatos].
 8 [M] No responde de forma directa al cliente; elude las preguntas.
11 [C] Descalifica a los pares, a BancoEstado o a la competencia.
10 [M] La atención no se ajusta a la política de BancoEstado.

### E. Tipificación (comparar con la tipificación registrada en los metadatos)
Primero determina, según la grabación: resultado de la gestión por cada seguro
(RENUNCIA / RETENCIÓN / SIN GESTIÓN) y el motivo de renuncia expresado por el cliente.
Luego compara con lo tipificado:
18 [M] Tipifica un motivo de renuncia incorrecto.
19 [C] Tipifica renuncia y por grabación es retención.
24 [C] Tipifica retención y por grabación es renuncia.
20 [M] Tipifica renuncia de un seguro no mencionado.
21 [M] Tipifica renuncia que corresponde a otro seguro.
22 [M] Tipifica retención de un seguro no mencionado.
23 [M] Tipifica retención que corresponde a otro seguro.
25 [M] No tipifica todas las gestiones.

## Motivos de renuncia válidos (elige UNO por seguro, el que mejor represente lo que
dice el cliente; si no lo dice, usa "No informado")
No desea contraer más obligaciones | Problemas Económicos | Cliente posee otros Seguros |
Desconoce contratación del seguro | Información errónea entregada en la venta |
A cliente se le ofreció un mejor seguro en Banco | No recibió Póliza |
Disconformidad con coberturas | Cambio de situación laboral |
Mala experiencia con Banco Estado o con la Cía | Cliente se va fuera del País |
Disconformidad con la asistencia | Siniestro Rechazado por Compañía |
Recibe carta de adecuación | Cierre de Cuenta o Productos Banco |
Cliente no cumple condiciones de asegurabilidad | Cobro mal Realizado | Retracto |
Cambio de Beneficiario o Cargas | Aumento Valor de la Prima |
Cambio de Domicilio o Venta de Propiedad | Seguro ya Utilizado, no desea dar Continuidad |
No puede realizar el rescate del ahorro. | No puede ingresar al portal Metlife. |
Carga o beneficiario fallecido. | Error en la contratación del seguro |
No permite realizar cambio de beneficiarios en sucursal. | No informado
```

---

## 2. Mensaje de usuario (por llamada)

```text
## Metadatos
llamada_id: {{llamada_id}}
fecha: {{fecha}}
ejecutivo: {{ejecutivo_id}}
duracion_seg: {{duracion}}
esperas_seg: {{lista_de_esperas}}        # ej. [45, 130]
umbral_espera_seg: {{umbral_espera}}     # [DEFINIR] ej. 120

## Seguros del cliente consultados en la llamada
{{#seguros}}
- nombre: {{nombre}} | n_poliza: {{n_poliza}} | retenible: {{si/no}} | renunciable_en_canal: {{si/no}}
{{/seguros}}

## Tipificación registrada por el ejecutivo
{{#tipificaciones}}
- seguro: {{n_poliza}} | gestion: {{RENUNCIA/RETENCION}} | motivo: {{motivo}}
{{/tipificaciones}}

## Ficha de producto (del seguro gestionado)
{{ficha_producto}}

## Transcripción (canal separado, timestamps mm:ss, datos personales enmascarados)
{{transcripcion}}
```

**Ejemplo de ficha** (sale de la capacitación S4P y se guarda una por producto):

```text
Seguro de Desempleo – Créditos de consumo (trabajador dependiente)
- Prima única: se paga una sola vez por todo el período del crédito.
- Prima = tasa tramificada por plazo × monto del crédito.
- Cubre: desempleo según Código del Trabajo, Art. 159 N°1 (mutuo acuerdo/con indemnización),
  Art. 159 N°6 (caso fortuito o fuerza mayor), Art. 161 (necesidades de la empresa),
  Art. 163 (procedimiento concursal de liquidación).
- Paga hasta 5 cuotas del crédito (103,5 %): 2 cuotas de una vez (contra finiquito)
  y 3 cuotas después de acreditar 60 días de desempleo.
- Sin tope de cuota. Carencia: 90 días.
- Debe permanecer 6 meses en el nuevo trabajo para volver a cobrar.
```

---

## 3. Esquema de salida (tool forzada)

```json
{
  "name": "registrar_auditoria",
  "input_schema": {
    "type": "object",
    "required": ["resumen", "intencion_renuncia", "gestiones", "criterios"],
    "properties": {
      "resumen": { "type": "string", "description": "2-3 frases sobre la llamada" },
      "intencion_renuncia": {
        "type": "object",
        "properties": {
          "expresada": { "type": "boolean" },
          "cita": { "type": "string" },
          "timestamp": { "type": "string" }
        }
      },
      "gestiones": {
        "type": "array",
        "description": "Resultado según la grabación, por seguro",
        "items": {
          "type": "object",
          "properties": {
            "n_poliza": { "type": "string" },
            "resultado_grabacion": { "enum": ["RENUNCIA", "RETENCION", "SIN_GESTION"] },
            "motivo_renuncia": { "type": "string" },
            "n_objeciones": { "type": "integer" },
            "evidencia": { "type": "string" }
          }
        }
      },
      "criterios": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["id", "estado", "confianza"],
          "properties": {
            "id": { "type": "integer", "minimum": 1, "maximum": 33 },
            "estado": { "enum": ["cumple", "incumple", "no_aplica", "indeterminado"] },
            "confianza": { "type": "number" },
            "evidencia": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "t": { "type": "string" },
                  "hablante": { "enum": ["AGENTE", "CLIENTE"] },
                  "cita": { "type": "string" }
                }
              }
            },
            "comentario": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

## 4. Ejemplo de salida (llamada ficticia)

```json
{
  "resumen": "Cliente llama para renunciar al seguro de desempleo por problemas económicos. El ejecutivo argumenta 4 veces y finalmente procesa la renuncia, pero no indica el N° de seguro en el cierre.",
  "intencion_renuncia": { "expresada": true, "cita": "quiero dar de baja el seguro de desempleo", "timestamp": "00:41" },
  "gestiones": [
    { "n_poliza": "DES-CONS-XXXX", "resultado_grabacion": "RENUNCIA", "motivo_renuncia": "Problemas Económicos",
      "n_objeciones": 4, "evidencia": "02:10–04:55: cuatro intentos de retención tras negativas" }
  ],
  "criterios": [
    { "id": 3, "estado": "incumple", "confianza": 0.9,
      "evidencia": [
        { "t": "02:10", "hablante": "AGENTE", "cita": "pero piense que le cubre hasta cinco cuotas" },
        { "t": "04:55", "hablante": "AGENTE", "cita": "¿y si lo mantiene un mes más?" }
      ],
      "comentario": "4 objeciones después de la negativa del cliente; el máximo es 3." },
    { "id": 13, "estado": "incumple", "confianza": 0.85,
      "evidencia": [], "comentario": "Cierre 06:40–07:20: confirma la renuncia pero no menciona el número de seguro." },
    { "id": 6, "estado": "incumple", "confianza": 0.7,
      "evidencia": [ { "t": "03:30", "hablante": "AGENTE", "cita": "le paga tres cuotas" } ],
      "comentario": "La ficha indica hasta 5 cuotas." },
    { "id": 27, "estado": "no_aplica", "confianza": 0.95, "comentario": "No interviene un tercero." },
    { "id": 18, "estado": "incumple", "confianza": 0.8,
      "evidencia": [ { "t": "00:58", "hablante": "CLIENTE", "cita": "es que ahora no me alcanza, ando corto de plata" } ],
      "comentario": "Tipificado 'Cambio de situación laboral'; el cliente expresa Problemas Económicos." }
  ]
}
```

---

## Notas para la implementación

- **Qué hace mejor la capa 1 (reglas):** los motivos 13 y 15 (frases del cierre), 31 y 33 (preguntas de validación) y 1 (esperas, con los timestamps) se pueden revisar con regex o fuzzy matching. El LLM queda como respaldo cuando la regla no encuentra nada.
- **Tipificación (18–25):** el LLM solo extrae lo que pasó en la grabación (`gestiones`). La comparación con lo tipificado la hace el **motor de decisión** en código, que es más confiable y explicable.
- **Validar las citas:** después de la respuesta, verifica que cada `cita` exista en la transcripción. Si no aparece, el criterio pasa a `indeterminado`.
- **Pendiente con el cliente [DEFINIR]:** la gravedad de cada motivo, el guion exacto de cierre y de acreditación, el umbral de espera, el listado de seguros retenibles e irrenunciables por canal, y las fichas de los productos que se retienen en este canal.
- **Calibración:** corre el prompt sobre llamadas ya auditadas por el cliente y ajusta las definiciones donde haya más diferencias con los auditores.
