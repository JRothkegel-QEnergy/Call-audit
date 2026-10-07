# Auditoría de llamadas con IA · Qubico

App que audita automáticamente grabaciones de contact center. Primer cliente: retención de seguros de BancoEstado Corredores de Seguros. Transcribe el 100 % de las llamadas, las evalúa contra una pauta de calidad y deriva a revisión humana solo lo dudoso o lo que no cumple.

Contexto completo del negocio y del dominio: @docs/contexto.md

## Cómo trabajar acá

- Responde en español chileno informal, conciso y accionable.
- Prioriza soluciones simples, explicables y medibles contra el golden set.
- **No inventes datos del cliente.** Si falta un dato (gravedad de un motivo, guion de cierre, umbral de espera, etc.), márcalo como `PENDIENTE` y regístralo en `docs/pendientes-cliente.md`.
- **Verifica precios y modelos actuales antes de citarlos**: cambian seguido. No los escribas de memoria en código ni en docs.

## Arquitectura (6 etapas)

1. Ingesta de lotes (SFTP / S3 / API → validación → cola Redis/RQ o SQS)
2. Transcripción ASR por canal con timestamps (detrás de la interfaz `Transcriptor`)
3. Pre-proceso: separar canales, normalizar, **anonimizar PII antes de cualquier LLM externo**
4. Pipeline de capas en paralelo (detrás de la interfaz `Capa`): reglas determinísticas, LLM con checklist, modelo rápido opcional, extras
5. Motor de decisión **sin IA**: código determinístico → `cumple` / `no_cumple` / `dudosa`
6. Revisión humana y dashboard

## Reglas no negociables

1. **Contrato común**: toda capa devuelve el mismo JSON (ver `.claude/rules/contrato-capas.md`).
2. **La rúbrica es configuración versionada** (YAML en `rubricas/`), nunca un prompt hardcodeado.
3. **Trazabilidad**: cada decisión guarda modelo, versión de prompt, versión de rúbrica y versión de cada capa.
4. **Toda cita del LLM se valida contra la transcripción.** Si no aparece, el ítem pasa a `dudoso`.
5. **La IA genera hallazgos; un humano decide las consecuencias.** El sistema nunca aplica sanciones.
6. **Adaptadores intercambiables**: cambiar de proveedor de ASR o LLM es un cambio de configuración, no de código.
7. **Nunca** commitear audios, transcripciones reales, PII ni credenciales.

## Stack

Python + FastAPI + workers · PostgreSQL · S3 · React/Next.js · CloudWatch + Langfuse. ASR inicial AssemblyAI; LLM capa 2 Claude Haiku vía Message Batches API.

## Estructura del repo

```
src/auditoria/   backend (ingesta, asr, preproceso, capas, decision, api)
rubricas/        rúbricas versionadas por protocolo (YAML)
golden_set/      solo metadatos y scripts; los datos reales viven fuera del repo
tests/           pytest
frontend/        Next.js (cola del auditor, dashboard del supervisor)
docs/            contexto, ADRs, pendientes del cliente
```

## Git

Ramas `main` (producción) y `develop` (integración). Trabajo en `feature/*`, `fix/*`, `chore/*` desde `develop`. Detalle en `.claude/rules/git-flujo.md`.

## Agentes disponibles (`.claude/agents/`)

- `arquitecto-pipeline`: diseño de etapas, interfaces y contrato común.
- `ingeniero-rubricas`: traduce la pauta del cliente a rúbricas YAML.
- `ingeniero-llm`: prompts de capa 2, batches, validación de citas.
- `especialista-asr`: transcripción, WER, audio telefónico, español chileno.
- `evaluador-golden-set`: métricas de FP/FN contra llamadas ya auditadas.
- `revisor-privacidad`: PII, anonimización, Ley 21.719.
- `revisor-codigo`: revisión de cambios contra las reglas del proyecto.
