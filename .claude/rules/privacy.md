# Privacidad y datos personales (Ley 21.719)

- **Anonimizar antes de salir**: RUT, números de tarjeta, cuentas, teléfonos, correos y direcciones se enmascaran en el pre-proceso, antes de cualquier llamada a un LLM externo. Ninguna capa externa recibe texto sin anonimizar.
- El audio crudo solo va al proveedor de ASR aprobado. Si el cliente define que el audio no puede salir de Chile, el adaptador de ASR debe respetarlo (pendiente en `docs/client-open-questions.md`).
- **Nunca** commitear audios, transcripciones reales, exportaciones del cliente ni datos del golden set. Para tests se usan transcripciones sintéticas en `tests/fixtures/`.
- Nada de PII en logs, trazas de Langfuse, mensajes de error ni nombres de archivo. Loguear `call_id`, no el RUT.
- Credenciales solo por variables de entorno o gestor de secretos. `.env` está en `.gitignore`; existe `.env.example` sin valores reales.
- La IA genera hallazgos; **nunca** aplica sanciones ni decide consecuencias sobre un ejecutivo.
