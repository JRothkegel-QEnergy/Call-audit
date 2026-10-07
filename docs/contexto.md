# Contexto del proyecto · Auditoría de llamadas con IA (Qubico)

> Resumen para asistentes de IA que trabajen en este proyecto. Estado al 7 de octubre de 2026.

## Qué es

Qubico Energy (Johannes Rothkegel, Lead Developer; Agustín Desmadryl; Jean Paul de Dompierre) está construyendo una aplicación que **audita automáticamente las grabaciones de un contact center**. El primer cliente objetivo hace llamadas de **retención de seguros de BancoEstado Corredores de Seguros**: el cliente llama para renunciar a un seguro y el ejecutivo debe gestionarlo según una pauta de calidad.

Hoy un equipo de personas escucha las llamadas a mano y solo alcanza a auditar una muestra. La app transcribe el 100 % de las llamadas, las evalúa contra la pauta y deriva a revisión humana solo lo dudoso o lo que no cumple.

- **Volumen de referencia:** ~400.000 minutos de audio al mes (~6.700 h; ~100.000 llamadas de ~4 min, supuesto).
- **Metas de precisión:** hasta 5 % de falsos positivos y hasta 20 % de falsos negativos, medidos contra llamadas ya auditadas por el cliente (golden set).
- **Ingreso potencial estimado:** 10–15 MM CLP al mes.
- **Enfoque acordado:** partir con APIs en la nube y migrar a infraestructura propia cuando el volumen lo justifique.
- **El documento técnico es genérico a propósito:** sin fechas ni cronograma.

## Arquitectura (6 etapas)

1. **Ingesta de lotes:** recibe audios y metadatos por SFTP, bucket S3 o API, valida y encola (Redis/RQ o SQS).
2. **Transcripción (ASR):** audio a texto por canal (agente/cliente) con timestamps.
3. **Pre-proceso:** separa canales, normaliza el texto y anonimiza datos personales (RUT, tarjetas) antes de cualquier LLM externo.
4. **Pipeline de capas:** capas independientes que analizan la misma transcripción en paralelo.
   - **Capa 1 · Reglas determinísticas:** regex y fuzzy matching (rapidfuzz) para frases obligatorias o prohibidas, el cierre, la validación de identidad y los tiempos de espera.
   - **Capa 2 · LLM con checklist:** evalúa criterios de contexto o intención y devuelve JSON con veredicto, confianza y cita textual con timestamp.
   - **Capa 3 · Modelo rápido (opcional):** Jev (TypeSafe AI) como segunda opinión, o un clasificador propio (SetFit/BETO/XLM-R) entrenado con las correcciones humanas.
   - **Capa N · Extras (opcional):** sentimiento, silencios, menciones de reclamo o Sernac.
5. **Motor de decisión:** **sin IA**, código determinístico. Combina las capas según la rúbrica y umbrales por protocolo, y entrega **cumple / no cumple / dudosa**. También compara la tipificación del ejecutivo con lo que pasó en la grabación.
6. **Revisión humana y dashboard:** cola del auditor, vista del supervisor, alertas críticas y exportación.

## Principios de diseño

- **Contrato común:** todas las capas devuelven el mismo JSON (capa, versión, rúbrica, modelo, versión del prompt, veredicto, confianza, ítems con evidencia, costo, latencia).
- **La rúbrica es configuración versionada (YAML/JSON), no un prompt fijo.** Cada protocolo define criterios, tipo (compliance duro o calidad subjetiva), gravedad y regla de decisión.
- **Trazabilidad completa:** cada decisión guarda el modelo, el prompt, la rúbrica y las versiones de cada capa.
- **Monitoreo continuo:** muestreo humano permanente de las llamadas "cumple", más alertas de drift y de costo.
- **La IA genera hallazgos; un humano decide las consecuencias.** El sistema nunca aplica sanciones.
- **Adaptadores intercambiables:** transcripción y LLM van detrás de interfaces (`Transcriptor`, `Capa`), así que cambiar de proveedor es un cambio de configuración.
- **Toda cita del LLM se valida contra la transcripción.** Si la cita no aparece, el ítem pasa a "dudoso".

## Stack y opciones elegidas para empezar

| Servicio | Opción inicial | Alternativas | Costo/mes aprox. |
|---|---|---|---|
| Transcripción | AssemblyAI Universal-2 (0,15 USD/h) | AssemblyAI U3.5 Pro, OpenAI gpt-4o-mini-transcribe, Deepgram Nova-3, Whisper autoalojado (faster-whisper en GPU) | ~1.000 USD |
| LLM capa 2 | Claude Haiku 4.5 por Message Batches API (-50 %) | Gemini 3.5 Flash-Lite batch, gpt-6-luna | ~225 USD |
| Capa 3 | Ninguna, o Jev en prueba | Clasificador propio | 0–10 USD |
| Backend | Python + FastAPI, workers | — | — |
| Base de datos | PostgreSQL gestionado (AWS RDS) | Cloud SQL, autoadministrado | ~60 USD |
| Almacenamiento | S3 | GCS, propio | ~6 USD |
| Frontend | React / Next.js | Low-code para el piloto | ~20 USD |
| Observabilidad | CloudWatch + Langfuse | Grafana/Prometheus, Sentry | ~65 USD |

- **Operación total:** ~1.600 USD al mes (~1,5 MM CLP), de los cuales la transcripción es casi dos tercios.
- **Whisper autoalojado:** una GPU dedicada (~580 USD/mes) cubre el volumen, pero requiere 1–3 semanas de implementación y operación continua.
- **Uso del batch de Claude:** `client.messages.batches.create`, hasta 100.000 requests o 256 MB por batch, resultados en menos de 24 h. La rúbrica va en `system` con `cache_control`, y el JSON se fuerza con `tool_choice`.

## Desafíos técnicos conocidos

- **Audio telefónico (8 kHz):** el WER de Whisper sube de 3–6 % en audio limpio a 15–25 % en teléfono.
- **Español chileno:** modismos ("po", "cachai"), habla rápida y elisiones. Se mitiga con keyterms o prompting del ASR.
- **Alucinaciones de Whisper en silencios y música de espera:** se mitigan con VAD (Silero).
- **Datos críticos** (montos, RUT, productos): se usa vocabulario personalizado y se mide el WER con 50–100 llamadas reales transcritas a mano.
- **Legal:** Ley 21.719 de protección de datos. Hay que definir con el cliente si el audio puede salir de Chile y firmar un DPA.

## Dominio del cliente (retención de seguros BancoEstado)

- **Pauta de calidad:** 33 "motivos de no calidad" en 5 bloques:
  - Acreditación y protocolo de cierre: 31, 33, 29, 30, 13, 15, 27.
  - Conocimiento del producto: 4, 2, 6, 5, 28.
  - Gestión de la retención: 14, 17, 9, 16, 3 (máximo 3 objeciones), 12, 32, 7, 26.
  - Trato: 1, 8, 11, 10.
  - Tipificación: 18–25.
- **Motivos de renuncia:** lista cerrada de 27; por ejemplo, Problemas Económicos, Cambio de situación laboral, Desconoce contratación, Retracto.
- **Fichas de producto** (capacitación S4P, mayo 2026): desempleo e incapacidad temporal en créditos de consumo, salud incapacidad MYPE, Incendio Hogar, Sale Seguro y Protección Global. Se usan para detectar información errónea del ejecutivo.
- **Pendiente de definir con el cliente:**
  - La gravedad de cada motivo.
  - El guion exacto de cierre y de acreditación.
  - El umbral de espera excesiva.
  - Qué seguros son retenibles o irrenunciables por canal.
  - El acceso a llamadas ya auditadas (golden set).

## Usuarios y flujos principales

- **Auditor:** cola de casos ordenada por gravedad → detalle de llamada (audio, transcripción con marcas, checklist con evidencia) → confirmar o corregir con un motivo cerrado → siguiente caso, con atajos de teclado.
- **Supervisor:** dashboard diario → vista por agente → llamada → registro de feedback. Atiende alertas de incumplimientos críticos ya confirmados.
- **Administrador de calidad:** edita la rúbrica → la prueba en lote contra el golden set → publica una nueva versión.
- **Operación Qubico:** lotes y errores, monitoreo de drift y costo, y trazabilidad.

## Opciones de desarrollo (estimación)

| Opción | Equipo de 3 personas | Johannes solo con IA (Claude Code) |
|---|---|---|
| A · Piloto con APIs | ~815 h, ~17,6 MM CLP | ~380 h, ~9–10 semanas, ~9,7 MM CLP |
| B · Producción con APIs | ~1.370 h, ~28,6 MM CLP | ~640 h |
| C · Infraestructura propia | ~1.800 h, ~40,9 MM CLP | ~890 h |

## Entregables existentes

- Documento técnico (arquitectura, etapas, pipeline de capas, transcripción, mapa de IAs).
- Preguntas para el cliente.
- Historias de usuario HU-01 a HU-13.
- Flujos de usuario y wireframes en texto de las 3 tareas principales.
- Diagrama de flujo en FigJam.
- Excel de costos con escenarios A, B, C y D (solo con IA).
- PDF con los servicios y sus opciones.
- Prompt de ejemplo para la capa 2 con la pauta de retención.
