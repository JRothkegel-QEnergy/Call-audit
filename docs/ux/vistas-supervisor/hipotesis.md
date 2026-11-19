# Hipótesis a validar · Vistas de análisis para el supervisor

| ID | Supuesto | Cómo validarlo | Estado |
|---|---|---|---|
| H-01 | "Verónica" de la reunión es la misma "Vero" que hoy entra con rol Auditor (D-22 de call-audit) | Johannes confirma | Abierta |
| H-02 | Verónica es supervisora de calidad del lado de la corredora y tiene a cargo a los evaluadores que llenan la planilla | Rodrigo, en la reunión presencial | Abierta |
| H-03 | Verónica valora más ver *qué motivo* falla y *quién* es inconsistente que el % de aprobación global | Reunión presencial (K-01) | Abierta |
| H-04 | Una foto por corrida (actualizada cuando hay corrida nueva o planilla nueva) basta; nadie necesita datos del día | Johannes / Verónica | Abierta |
| H-05 | "Tipo de llamada" se puede derivar de datos que ya llegan (FLUJO, TIPO_SEGURO, motivo de renuncia) sin pedir nada nuevo a la empresa | Pregunta 3 | Abierta |
| H-06 | Mostrar sesgos de evaluadores con nombre puede generar resistencia en la empresa si llega sin acompañamiento | Reunión presencial | Abierta |
| H-07 | Un "referente de calidad" con nombre choca con la decisión previa de call-audit de no mostrar rankings de auditores (solo desvío contra la media del equipo, comentario en `auditors/page.tsx`) | Johannes decide | Abierta |
| H-08 | Con los datos actuales (~1.000 llamadas con planilla) muchos ejecutivos y evaluadores tendrán muestras chicas; las vistas deben marcar "pocas llamadas" (como en Cambio 20) | Datos | Abierta |
| H-10 | Verónica no lee estadística (kappa, intervalos); entiende porcentajes, "más o menos que el equipo" y "pocas llamadas" | Reunión presencial | Abierta |
| H-11 | Le basta llegar a la llamada y al minuto de la evidencia para dar feedback (P-07) | Guion §7, pregunta 4 | Abierta |
| H-12 | Los patrones tomados de herramientas de QA de contact center (calibración, varianza, motivo como unidad) se mantienen vigentes; no se verificaron contra versiones actuales | Benchmark puntual si se necesita | Abierta |
| H-13 | Separar severidad de consistencia evita castigar al evaluador estricto pero parejo | Revisión con Johannes y Agustín | Abierta |
| H-14 | Un umbral U de desacuerdo con la IA (p. ej. 15 % de las llamadas del motivo) separa "Se marca distinto" de "Parejo"; se ajusta con los datos reales de la foto | Primera foto real | Abierta |
| H-15 | Verónica prefiere entrar por Motivos antes que por Ejecutivos (W-01) | Card sorting en la reunión | Abierta |
| H-16 | Hoy el rol `supervisor` solo lo usan personas de Qubico o cuentas de demo; nadie de la empresa ve Discrepancias | Johannes revisó la base local (2026-11-17): el único supervisor es `supervisor.prueba`, que nunca inició sesión. Falta confirmar en producción | **Validada solo en local**; pendiente en producción |
| H-17 | Existen resultados por motivo de la corrida v3.0 (en producción o en archivos). En la base local `model_runs` solo tiene prompt_version 2.7 (800), 2.8 (400) y 2.10 (100); no hay v3.0 (revisado por Johannes, 2026-11-17). Si no existen, rige D-18 B (corridas distintas con rótulo) | Johannes / analista revisan producción y archivos | Abierta |
| H-18 | `use-audio.ts` permite saltar a un minuto; falta leer el parámetro `t` en `/calls/[id]` (hoy solo lee `serie`) | Revisión de código en la Fase 7 | Abierta |
| H-09 | Las alertas de ambigüedad pueden empezar con una regla sin IA (mismo motivo, mismo tipo de llamada, misma evidencia de la IA, distinto veredicto del evaluador) antes de pensar en similitud semántica | Fase 2 | Abierta |
| H-19 | Un gerente entiende el gráfico de pesas (IA vs auditor por motivo) sin explicación | Test de 5 segundos en la Fase 7 de la iteración 1 | Abierta |
| H-20 | A la gerencia de la corredora le importa primero el cumplimiento del equipo, no la precisión de la IA | Johannes (IT-Q3) / Verónica | Abierta |
| H-21 | Ver la dispersión de ejecutivos en orden alfabético, sin posiciones, no se percibe como ranking | Reunión con Verónica | Abierta |
| H-22 | El mapa de calor auditor × motivo permite distinguir "auditor que se aparta" (fila) de "motivo mal definido" (columna) sin explicación | Test en la Fase 7 de la iteración 1 | Abierta |
| H-23 | Con 4–6 auditores y ≥ 10 llamadas por celda, la mayoría de las celdas del cruce auditor × motivo tiene muestra suficiente; si no, se agrupa por bloque | Primera foto real | Abierta |
| H-24 | Verónica y los auditores entienden "criterio 18" aunque la pauta oficial y la planilla digan "motivo" | Reunión con Verónica (P-8) | Abierta |
