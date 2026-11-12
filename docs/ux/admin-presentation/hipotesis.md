# Hipótesis y supuestos · Avance del proyecto

| ID | Supuesto | Fase | Cómo se valida | Estado |
|---|---|---|---|---|
| H-01 | La vista se proyecta o se comparte por videollamada desde un laptop (1366×768 a 1920×1080) | 0 | Johannes confirma | Abierto |
| H-02 | Jean Paul de Dompierre es audiencia con el mismo interés que Agustín | 0 | Johannes confirma | Abierto |
| H-03 | Con calce 0,57 en un set balanceado, FP y FN por llamada en val promedian cerca de 43 %. La cifra exacta sale de recalcular desde las corridas guardadas, sin IA | 0 | `analista-datos` sobre la BD (sin costo) | Abierto |
| H-04 | Lo que la audiencia necesita en cada versión es val; test se muestra solo en las versiones que se decidió adoptar, para no "gastar" test ni pagar una prueba extra por versión | 0 | Johannes confirma | Abierto |
| H-05 | Los motivos "que más pesan" se eligen con una regla fija (p. ej. los 5 con más errores, FP + FN, en val) y no a mano, para que la lista sea comparable entre reuniones | 0 | Johannes confirma | Abierto |
| H-06 | US$ 0,0368 por llamada (capa 2) y ~US$ 23 por ronda vienen de corridas reales. Falta saber qué incluye la ronda (¿análisis de discrepancias ~US$ 20 + prueba en val de 220 llamadas ~US$ 8?). Las cifras no se citan sin verificar | 0 | `analista-datos` sobre `ModelRun`, `PromptEvaluation` y `discrepancy_analyses` | Abierto |
| H-07 | Agustín y Rodrigo no necesitan navegar la vista: la presenta Johannes | 0 | Decisión 1 | Abierto |
| H-08 | La primera versión es solo para Qubico; la versión para la corredora se diseña después, sobre la misma estructura | 0 | Decisión 1 | Abierto |
