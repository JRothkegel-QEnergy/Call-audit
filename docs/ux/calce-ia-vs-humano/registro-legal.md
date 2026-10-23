# Registro legal · Pestaña "Calce IA vs humano"

Ni el diseñador ni el usuario son abogados. "Requiere abogado: sí" = validar con asesoría profesional.

| ID | Requisito | Fase / pantalla | Riesgo | Estado | Requiere abogado |
|---|---|---|---|---|---|
| L-01 | El dashboard contiene datos personales reales (transcripciones, audios, nombre del ejecutivo, datos del seguro). La pestaña nueva no debe agregar datos personales nuevos: identifica llamadas por `id`/`stem`, no por nombre ni RUT. | Toda la pestaña; mapa de errores y tooltips | Medio | Abierto | No |
| L-02 | Ley 19.628 y Ley 21.719 (entrada en vigencia prevista para el 1-12-2026, a ~6 semanas): base de licitud, finalidad (I+D sobre datos entregados por el cliente) y minimización. Verificar que el contrato/encargo con BancoEstado cubre el uso de llamadas reales para evaluar modelos. | Transversal | Alto | Abierto | Sí |
| L-03 | Compartir por canal interno (`share_dashboard.py`): mantener acceso restringido al equipo, no subir al repo ni a servicios públicos; la pestaña no debe incluir enlaces que expongan rutas de audio fuera de localhost. | Exportación / compartir | Medio | Abierto | No |
| L-04 | Evaluación de personas: la pestaña compara modelos, no ejecutivos. No agregar rankings por ejecutivo en esta pestaña (la sección existente "Aciertos por ejecutivo" se revisa en Fase 2/3; riesgo de uso como control laboral). | AI / reorganización de secciones | Medio | Abierto | Sí (si se usa para evaluar ejecutivos) |
| L-05 | Transferencia internacional: las llamadas se enviaron a proveedores de modelos extranjeros. Fuera del alcance de la pestaña; se registra para trazabilidad. | Fuera de alcance | Alto | Registrado | Sí |
| L-06 | Accesibilidad (WCAG 2.2 AA como estándar del equipo; Ley 20.422 como referencia): heatmap y mapa de errores no deben depender solo del color; contraste de celdas en claro y oscuro. | Fase 5 / 7 | Bajo | Abierto | No |
