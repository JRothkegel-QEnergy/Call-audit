# Preguntas abiertas al cliente

Datos que **no** se deben inventar. Mientras sigan abiertos, el código y las rúbricas usan el marcador `TBD`.

| # | Pendiente | Impacta a | Estado |
|---|---|---|---|
| 1 | Gravedad de cada uno de los 33 motivos de no calidad | Rúbrica, motor de decisión, orden de la cola | Abierto. Propuesta empírica 2026-10-15 (100 llamadas reales): leves 2, 3, 16, 18, 25, 28, 30, 32; el resto grave. Desde 2026-10-16 los leves también rechazan, pero marcados para revisión (REC* en el dashboard) (`MINOR_CRITERIA` en `scripts/prompt_bench/real_calls.py`). Confirmar con el cliente |
| 2 | Guion exacto de cierre y de acreditación | Capa 1 (reglas) | Resuelto 2026-10-09: Script Retención BECS (julio 2026), incorporado en el prompt 2.1 |
| 3 | Umbral de espera excesiva | Capa 1 (tiempos) | Resuelto 2026-10-09: más de 30 s sin hablarle al cliente (nota de la pauta, motivo 1). Reabierto 2026-10-15: en las 100 llamadas reales el auditor aprobó silencios de 31 a 35 s y rechazó desde 40 s; el bench usa 35 s (`HOLD_LIMIT_SEC`). ¿El auditor mide la espera del sistema o el silencio en la grabación? |
| 4 | Seguros retenibles o irrenunciables por canal | Rúbrica, capa 2 | Resuelto 2026-10-09: hoja RESUMEN del Excel "Apoyo nuevo v1" (`scripts/prompt_bench/extract_catalog.py`) |
| 5 | Acceso a llamadas ya auditadas (golden set) | Evaluación, metas de FP/FN | Abierto |
| 6 | ¿El audio puede salir de Chile? DPA firmado (Ley 21.719) | Elección de proveedor ASR/LLM | Abierto |
| 7 | Fichas de los productos que se retienen en este canal | Capa 2 (motivos 2 y 6) | Resuelto 2026-10-09: una hoja por producto en el Excel de apoyo. Faltan fichas de los no retenibles y de algunos MetLife (SONAP) |
| 8 | Cómo se cuentan las objeciones del motivo 3: ¿el primer argumento tras la solicitud de renuncia cuenta? (el prompt 1.1 asume que sí) | Capa 2, motivo 3 | Abierto |
| 9 | ¿El protocolo de cierre aplica si no hubo gestión pedida por el cliente (ej. el ejecutivo "retiene" sin solicitud)? | Motivos 13, 15, 29, 30 | Abierto |
| 10 | ¿Cuándo corresponde devolución de primas y por producto? (motivo 28) | Capa 2 | Resuelto 2026-10-09: prima única de crédito → automática; anual → sí; mensual → requerimiento al 600 660 1212 op. 2 (hoja Otros) |
| 11 | ¿Qué cuenta como "medio de pago" en el cierre (cuenta de cargo, cargo en el crédito)? | Motivo 15 | Parcial: el medio de pago viene en la base (CRE, CCT, CTV, HIP, TCR, ...). Nota del motivo 15: "solo en medios de pago otro, no debe mencionarse". Confirmar qué es "otro" |
| 12 | Tipo de prima de Incendio Hogar, Sale Seguro TLMK y los no retenibles | Motivo 28 | Parcial 2026-10-13: el Excel estandarizado dice que Incendio Hogar y Sale Seguro TLMK son mensuales; los no retenibles y no renunciables siguen sin dato |
| 13 | ¿Qué motivo aplica si se tipifica RENUNCIA y por grabación fue una CONSULTA? | Tipificación | Abierto |
| 14 | Formato real del N° MUS A Neto | Capa 1 | Parcial: el script dice "terminado en" (4 últimos dígitos); falta el formato completo |
| 15 | La ficha de Desempleo e IT consumo del Excel de apoyo dice 4 cuotas; la capacitación S4P decía 5. ¿Cuál está vigente? | Motivos 2 y 6 | Abierto (se usa el Excel de apoyo) |
| 16 | Terceros con titular con discapacidad auditiva: el Excel de apoyo permite gestionar con RUT y N° de serie; el script exige sucursal con poder | Motivo 27 | Abierto (se usa el script) |
| 17 | Retracto: el Excel de apoyo deriva al 600 660 1212 op. 2; el script lo gestiona en la llamada como renuncia con motivo "Retracto" | Motivos 7 y 18 | Abierto (se usa el script) |
| 18 | No informar la devolución automática al renunciar un seguro de prima única o anual: ¿motivo 28 o 29? | Motivos 28, 29 | Abierto (el prompt lo deja como observación) |
| 19 | ¿Se evalúa el aviso de grabación del saludo y los elementos del cierre que no están en la pauta (fecha, vigencia, N° de póliza, N° de renuncia)? | Motivo 29 | Abierto (el prompt los deja como observación) |
| 20 | Observaciones del Excel estandarizado (hoja Observaciones): primas desplazadas en Vida e Invalidez, pólizas de 8 dígitos en Máxima Protección, dos reglas de apoyo solidario, pólizas faltantes de Cardif | Fichas | Abierto |
| 21 | Lista cerrada de motivos de corrección que usa el auditor al cambiar un hallazgo de la IA | Vista del auditor (HU-AUD-03), métricas de la IA | Abierto (propuesta en HU-AUD-03, tomada del prototipo) |
| 22 | ¿El supervisor aprueba todas las revisiones de los auditores o solo una muestra? | Flujo de cierre de casos (HU-SUP-07) | Resuelto 2026-10-14 (Johannes): por ahora aprueba **todas**; más adelante (`Post`) podrá configurar un % de muestreo de revisiones aceptadas y rechazadas |
| 23 | % de muestreo de llamadas "cumple" para revisión humana y metas de productividad del auditor | Cola del auditor (HU-AUD-07), dashboard de auditores | Abierto (el prototipo propone 5 %) |
| 24 | ¿A qué sistema QA o de gestión se envían las tareas de seguimiento de llamadas que no cumplen, y cómo se integra? | Exportación (HU-SUP-12) | Abierto |
| 25 | ¿Qué proveedor de SSO usan los auditores y supervisores del cliente (Microsoft Entra ID, Google Workspace, otro)? ¿SAML u OIDC? | Login (front), autenticación (backend) | Abierto (el login se diseña agnóstico: botón SSO genérico + cuenta propia) |
| 26 | Beneficios adicionales MetLife: lista de convenios, porcentajes y teléfono (Fono Beneficios) vigentes. Hoy la ficha solo trae un bloque genérico sin cifras (`METLIFE_BENEFITS` en `render.py`) | Capa 2 (motivos 2 y 6, regla 13) | Abierto |
| 27 | Retiro del ahorro en seguros con ahorro (Muerte Accidental con Ahorro / AP con Ahorro): los ejecutivos dicen "1 retiro total o hasta 4 parciales al año, uno por mes"; la ficha dice que se retira cuando el cliente quiera. ¿Cuál es la regla vigente? | Capa 2, motivos 2 y 6; catálogo | Abierto |
