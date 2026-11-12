# Plan · Loop de mejora del prompt (capa 2)

> Borrador del 2026-11-11. Pedido del jefe de Johannes: bajar a casi cero los desacuerdos atribuibles al prompt o a
> los criterios (rojo: IA Sí / Revisor No; amarillo: IA No / Revisor Sí), automatizando la iteración en la que la IA
> de análisis revisa los desacuerdos y propone reglas. El gráfico que lo muestra está en
> `docs/ux/admin-prompt-metrics/01-mosaico-brief.md`.

## Decisiones tomadas (Johannes, 2026-11-11)

- **Split 60/20/20 se mantiene:** entrenamiento 655, validación 219, prueba final 219 (`golden_split`).
- **Pausa en cada vuelta:** Johannes aprueba las reglas propuestas antes de que se prueben. Nada se publica solo.
- **Tope: 5 vueltas.**
- **Entrenamiento, solo desacuerdos:** cada vuelta re-corre en entrenamiento solo las llamadas que la versión
  anterior falló (≈ 260). Si la versión nueva rompe algo que estaba bien, lo detecta validación.
- **Análisis también en validación (D1):** sirve solo para atribuir la causa de cada desacuerdo (azul). Sus
  propuestas de regla se descartan, para no contaminar validación.
- **Color de cada desacuerdo (D2):** azul solo si todos los patrones que lo incluyen tienen la causa `auditor`. Lo
  demás va a rojo o amarillo según la dirección.

## Una vuelta

| # | Paso | Quién | Costo aprox. |
|---|---|---|---|
| 1 | Probar la versión actual sobre los desacuerdos de entrenamiento | worker | ≈ US$7,6 |
| 2 | Analizar esos desacuerdos (patrones, causa, propuesta) | worker | ≈ US$3–5 |
| 3 | **Aprobar las reglas propuestas** (vista de propuestas que ya existe) | Johannes | — |
| 4 | Armar la versión nueva con las reglas aceptadas (`prompt_followup.create`) | worker | — |
| 5 | Probar la versión nueva en validación | worker | ≈ US$6,4 |
| 6 | Analizar los desacuerdos de validación, solo para el azul | worker | ≈ US$3–5 |
| 7 | Comparar con la vuelta anterior y decidir si sigue | código | — |

Una vuelta cuesta entre US$20 y US$24, y 5 vueltas entre US$100 y US$120. El análisis de validación (paso 6), que
se sumó con D1, sube el total sobre los ≈ US$90 que se aprobaron antes. Los costos son estimaciones: el monto real
sale del uso que devuelve el proveedor, y cada vuelta muestra su estimado antes de correr.

## Cuándo para

- **Vueltas:** llegó a la 5.ª.
- **Sin mejora:** el rojo no baja en validación.
- **Empeora:** el amarillo sube más de un margen que hay que definir.
- **Johannes lo detiene.**

Al terminar, la mejor versión se confirma una sola vez en la prueba final, antes de publicarla. Publicar sigue siendo
manual.

## Qué falta en el código

1. **`PromptEvaluation` sobre otro set:** hoy siempre usa validación. Hay que poder pasarle el set y una lista de
   llamadas (los desacuerdos de entrenamiento). El campo `case_ids` ya existe.
2. **Análisis desde una prueba:** hoy `discrepancy_runs` arma la tabla con la corrida vigente de producción. Hay que
   armarla con los resultados de una `PromptEvaluation`, y guardar en el análisis de qué prueba sale y para qué sirve
   (`rules` o `attribution`).
3. **Atribución por caso (D2):** una función que cruce los patrones del análisis de validación con cada desacuerdo
   (llamada × motivo) y lo marque azul, rojo o amarillo. También el agregado por llamada. Es la fuente de datos del
   gráfico.
4. **Orquestador del loop:** una tabla `prompt_loops` con su estado (vuelta, paso, versiones, costo acumulado, tope) y
   un paso nuevo del worker que avanza la máquina de estados y espera en el paso 3.
5. **UI:** el inicio y avance del loop, y el gráfico. Pasan por el diseñador UX (`docs/ux/admin-prompt-metrics/`).

## Riesgos

- **Sobreajuste a validación:** con 5 vueltas, el prompt empieza a ajustarse a esas 219 llamadas. La prueba final es
  la que da la cifra sin sesgo.
- **El azul es un juicio de la IA:** se rotula "según el análisis" y el loop nunca optimiza contra él, porque la forma
  fácil de bajar el rojo sería pasarlo a azul.
- **El rojo no llega a cero** mientras haya desacuerdos de definición, como el motivo 18 (pregunta abierta n.º 29).
