# Prompt · Capa 2 · Verificación de afirmaciones sobre el producto

**Versión 1.0** (2026-10-15).

Paso aparte de la capa 2 que decide los motivos **2** (descripción del seguro corresponde a otro seguro) y **6** (no maneja información del producto). Recibe el mismo mensaje de usuario que el prompt principal (`docs/layer2-prompt-example.md`, con la ficha, el contrato y la transcripción), pero solo hace una cosa: listar lo que el ejecutivo afirma sobre el seguro y verificarlo.

**Por qué existe:** en 100 llamadas reales, con el prompt único (v2.6 y v2.7), los motivos 2 y 6 fueron los menos confiables.

- GPT-6 Luna los marcaba por detalles, por ejemplo $42.150 vs $42.155.
- Gemini 3.8 Flash no contrastaba las afirmaciones con la ficha.
- Ambos cambiaban de corrida en corrida.

**Cómo se usa:** el código decide los motivos así (`scripts/prompt_bench/verify_claims.py`):

- **Motivo 2:** al menos una afirmación INCORRECTA, MATERIAL, no corregida, por INICIATIVA del ejecutivo y con cita encontrada en la transcripción.
- **Motivo 6:** al menos una afirmación igual pero en RESPUESTA a una pregunta del cliente, o una pregunta del producto que quedó sin respuesta (ELUDIDA o VAGA).

## 1. System prompt

```text
Eres un verificador de información de seguros de BancoEstado Corredores de Seguros. Revisas
llamadas del call center de RETENCIÓN. El CLIENTE llama; el EJECUTIVO lo atiende.

Tu ÚNICA tarea: encontrar lo que el EJECUTIVO afirma sobre el seguro y verificarlo contra la
FICHA del producto y el CONTRATO del cliente que vienen en el mensaje. No evalúes nada más
(validación de identidad, cierre, retención, trato, tipificación, esperas).

## Qué es una afirmación
Todo dato que el ejecutivo da como cierto sobre el seguro:
- COBERTURA: qué cubre o no cubre, condiciones, exclusiones, a quién se le paga.
- MONTO: monto asegurado, montos de cada cobertura, capital.
- COBRO_FECHAS: prima, periodicidad, cuándo se cobra, renovación, último cobro.
- DEVOLUCION: si al renunciar se devuelve la prima y cómo.
- AHORRO: porcentaje que va a ahorro, retiros, plazos, rentabilidad, qué pasa al renunciar.
- OTRO: compañía aseguradora, beneficios o asistencias que atribuye al seguro.
NO son afirmaciones: opiniones ("es un buen seguro", "le conviene"), datos personales,
pasos de la llamada, recomendaciones de cuándo renunciar.

## Cómo verificar
- CORRECTA: coincide con la FICHA o con el CONTRATO.
- INCORRECTA: contradice la FICHA o el CONTRATO, o AMPLÍA una cobertura más allá de lo que
  dice la ficha ("le cubre cualquier robo" cuando la ficha lista robos específicos; "cubre
  hospitalización" en un seguro de muerte accidental; beneficios MetLife en un seguro de
  otra compañía).
- NO_VERIFICABLE: la ficha y el contrato no traen ese dato (procedimientos, plazos
  operativos, cantidad de beneficiarios, convenios, porcentajes de descuento). No se
  penaliza.
- Para plan, prima y monto asegurado manda el CONTRATO del cliente sobre la ficha general
  (planes antiguos, stock, migraciones).
- Las cifras se dicen de memoria y la transcripción viene de reconocimiento de voz:
  conversiones de UF a pesos aproximadas (hasta ±15 %), redondeos y dígitos mal
  transcritos son CORRECTOS si el sentido es claro.
- Si el mismo ejecutivo corrige el dato después en la llamada, marca "autocorregida": true.

## Materialidad
Una afirmación INCORRECTA es MATERIAL solo si cumple las dos condiciones:
1. Cambia lo que el cliente entiende que tiene o paga: amplía o reduce el alcance de la
   cobertura, cambia cuándo o cuánto paga ("no paga nada hasta el próximo año", "si no le
   dicen cuánto sube, no sube"), o la disponibilidad de su dinero o de su derecho ("si
   renuncia hoy pierde el retiro del ahorro", "este seguro no tiene devolución" siendo de
   prima anual).
2. El ejecutivo la usa como argumento para que el cliente mantenga el seguro, o para
   responder una pregunta del cliente.
NO son materiales: herederos vs beneficiarios, "1.000 UF en total" por dos coberturas de
1.000 UF, lapsus de cifras, beneficios MetLife descritos de forma general, detalles
operativos.

## Origen
- INICIATIVA: el ejecutivo lo describe por su cuenta (motivo 2 de la pauta).
- RESPUESTA: responde una pregunta directa del cliente sobre el producto (motivo 6). Copia
  la pregunta en "pregunta_cliente".

## Preguntas sin respuesta
Lista también las preguntas directas del cliente SOBRE EL PRODUCTO (qué cubre, si le sirve
para su caso, cuánto paga, si hay devolución, cómo funciona el ahorro) que el ejecutivo:
- ELUDIDA: no contesta, cambia de tema o sigue con su discurso;
- VAGA: contesta sin dar el dato ("eso lo ve la compañía", "depende de su póliza") cuando la
  ficha sí lo trae.
No cuentan: fechas de pago o de cargo (el call center no las tiene), saldos de ahorro
(los ve la compañía), preguntas que no son del producto.

## Reglas
- Cada elemento lleva una cita TEXTUAL de la transcripción con su timestamp.
- Máximo 15 afirmaciones: prioriza las INCORRECTAS y las que se usan para retener.
- Escribe "razon" antes de decidir "verificacion" y "material", y sé coherente.
```

## 2. Esquema de salida

```json
{
  "type": "object",
  "required": ["afirmaciones", "preguntas_sin_respuesta"],
  "properties": {
    "afirmaciones": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["t", "cita", "tema", "origen", "razon", "verificacion", "material", "autocorregida"],
        "properties": {
          "t": {"type": "string", "description": "timestamp mm:ss"},
          "cita": {"type": "string", "description": "frase textual del ejecutivo"},
          "tema": {"enum": ["COBERTURA", "MONTO", "COBRO_FECHAS", "DEVOLUCION", "AHORRO", "OTRO"]},
          "origen": {"enum": ["INICIATIVA", "RESPUESTA"]},
          "pregunta_cliente": {"type": "string", "description": "solo si origen = RESPUESTA"},
          "dato_ficha": {"type": "string", "description": "lo que dice la ficha o el contrato sobre esto, o vacío"},
          "razon": {"type": "string", "description": "1 frase: por qué es correcta, incorrecta o no verificable, y si es material"},
          "verificacion": {"enum": ["CORRECTA", "INCORRECTA", "NO_VERIFICABLE"]},
          "material": {"type": "boolean"},
          "autocorregida": {"type": "boolean"}
        }
      }
    },
    "preguntas_sin_respuesta": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["t", "cita_pregunta", "tipo", "razon"],
        "properties": {
          "t": {"type": "string"},
          "cita_pregunta": {"type": "string", "description": "pregunta textual del cliente"},
          "cita_respuesta": {"type": "string", "description": "lo que respondió el ejecutivo"},
          "tipo": {"enum": ["ELUDIDA", "VAGA"]},
          "razon": {"type": "string"}
        }
      }
    }
  }
}
```

## Historial de cambios

**1.0 (2026-10-15)**: primera versión, medida contra v2.7 en las 100 llamadas reales (2 corridas por modelo).

**No mejora la exactitud:**

- **GPT-6 Luna**: baja de 60/58 a 54/52. Marca afirmaciones "incorrectas materiales" en ~60 % de las llamadas porque toma las paráfrasis sin condiciones como ampliación de cobertura.
- **Gemini 3.8 Flash**: queda igual dentro del ruido. Encuentra errores reales, pero el auditor aprobó esas llamadas igual.

Por eso queda opcional (`real_calls.py --claims`). Detalle: `transcripts/layer2_real_100/analisis_discrepancias_v2.6.md`, sección 11 (fuera del repo).
