# Registro legal · "Segunda opinión Jev"

Complementa `../registro-legal.md` (L-01 a L-06 siguen aplicando). Ni el diseñador ni el usuario son abogados.

| ID | Requisito | Fase / pantalla | Riesgo | Estado | Requiere abogado |
|---|---|---|---|---|---|
| L-J1 | El bloque Jev agrega números por par y, desde la ronda 2, las instrucciones enviadas a Jev. Las instrucciones "con hallazgo" incluyen el comentario y las citas de Gemini (texto ya anonimizado y ya visible en la misma pantalla); el `state` (prompt de la llamada) **no** se incrusta para no duplicar la transcripción. No se agregan datos personales nuevos. | Detalle, `D.jev.prompts` | Bajo | Abierto | No |
| L-J2 | La etiqueta por motivo es un juicio sobre la conducta de un ejecutivo identificable (dato sobre desempeño laboral). Uso solo para evaluar modelos (I+D); `revision_capa2.csv` fuera del repo; no construir vistas por ejecutivo con estas etiquetas (ver L-04). | Etiqueta por motivo, CSV | Medio | Abierto | Sí, si se usara para evaluar ejecutivos |
| L-J3 | El experimento ya envió transcripciones (anonimizadas por `real_calls.py build`) a TypeSafe AI, un proveedor adicional. Verificar que el encargo/DPA con BancoEstado cubre a este proveedor y la transferencia internacional (amplía L-05). Fuera del alcance de la UI; se registra. | Fuera de alcance | Alto | Registrado | Sí |
| L-J4 | Accesibilidad: grilla con texto además de color, radios con área ≥ 24 px, tabla semántica (WCAG 2.2 AA). | §5 de la especificación | Bajo | Abierto | No |
