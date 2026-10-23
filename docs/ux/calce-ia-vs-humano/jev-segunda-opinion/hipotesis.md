# Hipótesis · "Segunda opinión Jev"

| ID | Hipótesis | Origen | Cómo validarla | Estado |
|---|---|---|---|---|
| H-J1 | El modo ciego es el único informativo; el modo con hallazgo está anclado a Gemini. | Resultado del experimento (agente principal) | Acierto por variante con las 28 etiquetas por par | Abierta |
| H-J2 | En llamadas APROBADAS del Excel no todos los motivos que marca Gemini son falsas alarmas (extiende H-01 del padre); por eso la etiqueta por par vale más que el Excel o el veredicto por llamada. | Caso motivo 16 | Proporción de pares etiquetados "Sí, incumple" | Abierta |
| H-J3 | Ver la opinión de Jev antes de etiquetar ancla la etiqueta de Johannes. | Diseñador [SUPUESTO] | Comparar etiquetas "ciego" vs "visto" (columna CSV) | Abierta |
| H-J4 | Con p agrupadas en 0,4–0,8, la banda 0,40–0,60 concentra la mayoría de los pares y el umbral 0,5 es frágil. | Diseñador | Contar pares en la banda por variante | Abierta |
| H-J5 | Las etiquetas no se atribuyen a una persona (igual que hoy); si la otra persona del equipo también etiqueta, no se distinguen. | Diseñador [SUPUESTO] | Confirmar con Johannes si importa | Abierta |
| H-J7 | La confianza de Choice está calibrada: con confianza < 50 % Jev se equivoca más que con ≥ 50 %. Si no, el umbral de "decisión poco segura" no sirve para priorizar revisión. | Diseñador [SUPUESTO] + definición del SDK | Columna "Acierta con confianza ≥ 50 % · < 50 %" con las 28 etiquetas | Abierta |
| H-J8 | La pregunta de opciones es mejor que la sí/no (19 vs 16 coincidencias con la referencia por llamada). Son 3 pares sobre 28 contra una referencia aproximada: no concluyente. | Resultados ronda 2 | Acierto con etiquetas por par, ciego opciones vs ciego sí/no | Abierta |
| H-J6 | El caso "llamada rechazada con motivo 16 mal aplicado" es una llamada que el Excel aprobó y que Johannes rechazó en su revisión manual. | Interpretación del pedido | Confirmado por Johannes: llamada 230188 (Excel APROBADA, manual RECHAZADA por otro motivo; Jev acertó al revertir el 16) | Validada |
