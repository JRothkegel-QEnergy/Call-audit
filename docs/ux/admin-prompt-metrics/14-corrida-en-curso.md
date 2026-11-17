# Corrida completa en curso en Calidad de la IA · Revisión rápida

- **Fecha:** 2026-11-16 · **Pide:** Johannes (vía coordinador).
- **Ya decidido por Johannes:** la corrida completa en curso aparece como serie seleccionable, con tarjetas y mosaico calculados
  sobre las llamadas de validación ya terminadas, y se actualiza al recargar.
- **Base aprobada:** `05-numeros-propuesta.md` (N-R1, cabecera N2, metas con ícono + texto), `06-ajustes-feedback.md` §2 (Análisis por
  caso) y §5 (control «Ver:», `aria-live`). Cambio menor: un gate, decisiones U1-U5.
- **Fuera:** temas legales y anonimización (instrucción de Johannes).

## 1. Microcopy

| Lugar | Texto |
|---|---|
| Opción del selector «Ver:» | **Corrida completa v3.0 · en curso** (ícono estático de reloj, sin animación; «en curso» siempre en texto) |
| Título | Calidad de v3.0 · corrida completa en curso |
| Subtítulo de universo | **87 de 220 llamadas de validación · en curso** (con errores: «… · 2 con error de la IA, fuera del cálculo») |
| Aviso de cifras parciales (bajo el subtítulo, tono informativo, no alerta) | **Cifras parciales: salen de las 87 llamadas de validación que ya terminaron y van a cambiar hasta que termine la corrida. Las metas se evalúan al terminar.** |
| Línea de hora + acción | Cifras a las 10:42 · **Actualizar** (botón) |
| Línea de avance (arriba, igual que la de pruebas, se ve con cualquier serie activa) | **Corrida completa de v3.0 en curso: 412 de 1.100 llamadas (87 de 220 de validación) · Ver cifras parciales** |
| Antes del mínimo (U4) | Todavía hay pocas llamadas de validación terminadas (12 de 220). Las cifras aparecen desde las 20. |
| Al terminar (si estaba activa) | La opción pasa a «Corrida completa v3.0» y queda activa; `aria-live`: «Terminó la corrida completa de v3.0. Cifras finales.» |
| Tarjeta «Posible error del revisor» | Igual que hoy sin análisis de causa: «Causa sin analizar» (no hay `attribution` de una corrida a medias) |
| Comparación entre versiones | Fila «Corrida completa v3.0 · en curso (87 de 220)», sin ✓/✗ y sin «Cambio vs.» |
| Resumen del mosaico (`role="img"`) | «v3.0, corrida completa en curso, cifras parciales: N falsas alarmas y N rechazos no detectados en 87 llamadas» |

- La línea de avance de pruebas y la de corridas completas son la misma pieza; si hay ambas, dos líneas. «Ver cifras parciales»
  activa la serie (mismo efecto que el selector). Para pruebas sigue «Ver avance».
- **No es la serie por defecto:** al abrir la pantalla la activa sigue siendo la última terminada; la en curso se elige a mano o
  desde la línea de avance (U1).

## 2. Metas con muestra parcial

Recomendado: **badge neutro, sin ✓/✗, mientras está en curso**: «Parcial · meta ≤ 5 %» en gris (borde + texto, contraste ≥ 4,5:1).
Razón: con 87 llamadas hay ≈ 43 aprobadas y una falsa alarma mueve ≈ 2,3 puntos; un «Fuera de meta» que pasa a «Cumple» en la
próxima recarga entrena a no creer el badge. El % se muestra igual. La sublínea «Cumpliría…» (sin el azul) no aplica: no hay azul.
`aria-label` de la tarjeta: «…, cifra parcial, la meta se evalúa al terminar».

## 3. Análisis por caso y «Ver llamadas»

Habilitados, sobre las llamadas de validación ya terminadas (los datos de cada llamada terminada son finales, no cambian).

- Lista y mapa: mismas reglas de `06` §2, con el universo «87 de 220».
- Clic al caso: **solo si la página de caso acepta una corrida no terminada** (hoy exige prueba terminada, desvío del 12-nov). Si
  no la acepta, las columnas no enlazan, como en la vigente sin prueba, con la nota «Cada llamada se puede abrir cuando termine
  la corrida». Lo verifica el coordinador en código; no hay que preguntarle a Johannes.

## 4. Refresco

**No refrescar las cifras solas.** Botón «Actualizar» + hora de las cifras (y la recarga del navegador sigue sirviendo).
Opcional, barato: consultar solo el contador cada 60 s y, si cambió, que la línea de hora diga «Cifras a las 10:42 · hay 9 llamadas
nuevas · Actualizar». Las tarjetas, el mosaico y el mapa no se mueven mientras se leen o se tiene el foco en una celda.

## 5. Accesibilidad (WCAG 2.2 AA)

- **2.2.2** Contenido que se actualiza solo: evitado al no auto-refrescar cifras. Si se hace el contador opcional, es una línea de
  texto y no se anuncia.
- **4.1.3** Mensajes de estado: `aria-live="polite"` solo tras «Actualizar» («Cifras actualizadas: 95 de 220 llamadas de
  validación») y al terminar; nunca en cada sondeo.
- **2.4.3 / 2.4.7** Al actualizar no remontar la vista: el foco queda en «Actualizar» (o donde estaba) y la serie activa no cambia.
- **1.4.1** «En curso» y «Parcial» en texto, no solo color o ícono.
- **2.3.3 / reduced motion** Sin spinner ni pulso en la opción ni en la línea de avance.
- **2.5.8** «Actualizar» y «Ver cifras parciales» ≥ 24 × 24 px.

## 6. Supuestos y riesgos

- **[SUPUESTO] H-U1:** las llamadas de validación que terminan primero son una muestra parecida a las 220. Si la corrida procesa en
  orden (fecha, producto, caso), las cifras parciales vienen sesgadas y el aviso se queda corto. **Revisar en código el orden de la
  corrida**; si es ordenado, agregar al aviso «Las primeras llamadas no son una muestra al azar».
- **R-U1:** dos «v3.0 completa» (en curso y una terminada anterior) si se relanza; el sufijo «· en curso» las distingue.

## 7. Decisiones para Johannes

| # | Decisión | Opciones | Recomendada |
|---|---|---|---|
| U1 | Serie por defecto al abrir | A sigue siendo la última terminada; la en curso se elige o se abre desde la línea de avance · B la en curso pasa a ser la activa | A |
| U2 | Metas con cifras parciales | A badge neutro «Parcial · meta ≤ X %» hasta terminar · B badge ✓/✗ normal · C ✓/✗ desde la mitad de las 220 | A |
| U3 | Refresco | A botón «Actualizar» + hora, sin auto-refresco · B A más aviso de «hay N llamadas nuevas» cada 60 s · C auto-refresco de todo cada 60 s | A (B si es barato) |
| U4 | Mínimo para mostrar cifras | A desde 20 llamadas de validación; antes, solo el contador · B desde la primera | A |
| U5 | Línea de avance para corridas completas | A sí, con «Ver cifras parciales» · B no, solo el selector | A |

Esperando aprobación para continuar con la implementación (U1-U5).
