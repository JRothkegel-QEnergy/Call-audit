# 13 · Rol verificador y asignación de casos (propuesta, 2026-11-13)

Cambio sobre la verificación caso a caso ya aprobada (`04-verificacion-propuesta.md`, `05-numeros-propuesta.md`).
Un solo gate: decisiones V1-V9. Sin código de UI hasta que se aprueben. Legal omitido por instrucción de Johannes.

**Ya decidido por Johannes (no se vuelve a preguntar):** rol `qubico_verifier` («Verificador»); ve la pantalla de la
versión, el mosaico, las listas por segmento y la revisión del caso, con la planilla visible; registra solo en sus
llamadas asignadas; no ve cuentas, prompts para activar ni catálogo. Asignación por llamada (tabla nueva), estratificada
por segmento entre 5 personas. El admin ve el avance y asigna/reasigna.

## Aprobación (2026-11-13)

Johannes: V1 **B**; V2, V3, V4, V5, V6, V8, V9 **A**; V7 **fuera de alcance** («eso veámoslo después, ahora solo
haremos ese trabajo de revisión»). La tabla de abajo queda como registro de la propuesta; lo vigente es esta sección.

**Unidad de trabajo (ajustada por V1 B):** una llamada asignada está **revisada** cuando:

- **tiene motivos en desacuerdo:** todos tienen registro (`DisagreementVerification`, por llamada × motivo, sin
  cambios), igual que hoy; o
- **no tiene motivos en desacuerdo:** el verificador pulsa `Sin observaciones` en la revisión del caso (un clic; el
  foco pasa a «Siguiente»). Se guarda en la **tabla de asignación** (quién y cuándo), no en `DisagreementVerification`.
  Se puede deshacer con `Deshacer` (V9: solo el propio; el admin, cualquiera). En la sección «Por verificar (0)» va
  el texto: «La IA y la planilla coinciden en todos los motivos. Si estás de acuerdo, márcala sin observaciones.»

**Cambios por V7 fuera de alcance:** el diálogo `Repartir llamadas` no tiene % doble; la tabla de avance no tiene
«Acuerdo en dobles»; no existe la lista «Desacuerdo entre verificadores»; el modelo de registros no cambia. Cada
llamada tiene un solo verificador.

**Punto abierto (O-V1):** en una llamada sin desacuerdos (o en los motivos «Coinciden con la planilla»), si el
verificador cree que la IA **y** la planilla se equivocan, hoy no hay dónde registrarlo. Propuesta mínima: nada
nuevo en esta entrega; lo anota en la nota de la llamada si existe, o se deja para después.

---

**Unidad de trabajo (propuesta original, reemplazada arriba):** una llamada está **completa** cuando todos sus motivos en
desacuerdo con la planilla tienen registro (`DisagreementVerification`, por llamada × motivo, vale para toda versión).

---

## Decisiones

| # | Pregunta | Propuesta (A) | Alternativa (B) |
|---|---|---|---|
| V1 | ¿Qué llamadas se reparten? | Solo las que tienen **al menos un motivo en desacuerdo** con v2.15 y algún motivo **sin registro** (incluye las de «Coincide con el revisor» con motivos en desacuerdo). Las que coinciden en todo no se asignan: no hay nada que registrar. Lo ya verificado por el admin cuenta como hecho. Se reparte **después** de que termine la corrida v2.15. | Repartir las ~1.100 completas, incluidas las de acuerdo total, para revisar también los aciertos. |
| V2 | ¿Qué ve el verificador al entrar? | Menú con un solo ítem, **«Verificación»**, que abre la pantalla de la versión fijada por el admin (v2.15) en la pestaña Verificación, con el filtro «Mis llamadas» puesto. Arriba, una tarjeta: «Te quedan {d} de {n} llamadas» + botón `Seguir revisando` (va a tu próxima pendiente). Debajo, el mosaico y las listas de siempre, contando solo lo tuyo. Sin pestañas de Prueba/Activar ni selector de versión. | Pantalla nueva «Mis llamadas» (solo lista) fuera de `/admin`. |
| V3 | «Mis llamadas» vs. todas | Control `Asignadas a: Mí · Todas` (por defecto Mí). Mosaico, cifras y listas siguen al filtro. «Siguiente» recorre la lista actual y salta a tu próxima pendiente. El admin tiene el mismo control con `Todos · {verificador} · Sin asignar`. | Solo «Mis llamadas»; el verificador no ve las de otros. |
| V4 | ¿Qué pasa al abrir una llamada no asignada? | Se ve **en solo lectura** (igual que hoy el viewer), con un aviso arriba: «Esta llamada está asignada a {nombre}. Puedes verla, pero no registrar.» (sin asignar: «Esta llamada no está asignada a ti.»). Sin botón para tomarla. | Botón `Tomar esta llamada` si no tiene asignación. |
| V5 | ¿Cómo asigna y reasigna el admin? | En la pestaña Verificación del admin, sección **«Verificadores»** con botón `Repartir llamadas`: diálogo con casillas de las cuentas verificador (no premarcadas), % doble (10 por defecto), vista previa «Ana 182 · Beto 181…» por segmento y botón `Repartir {N} llamadas`. Reparte solo lo **sin asignar y pendiente**, estratificado por **segmento × split**, determinístico; lo ya asignado no se mueve. Reasignar: por fila, `Pasar pendientes a…` (reparte las pendientes de esa persona entre las que elijas) y, en la revisión del caso, `Asignada a: [selector]` solo para el admin. Lo ya registrado nunca cambia de dueño. | Asignación manual por selección de llamadas en las listas. |
| V6 | Vista de avance | Tabla en la sección «Verificadores» (admin y viewer): Verificador · Asignadas · Completas · Pendientes · barra de % · Última actividad · Acuerdo en dobles. Fila «Sin asignar» y fila Total. Al expandir una fila: las mismas cifras por segmento. Clic en «Pendientes» abre la lista filtrada a esa persona. | Solo los totales por persona, sin desglose. |
| V7 | Doble asignación | **Sí, 10 %** de las llamadas repartidas, en pares rotativos (los 10 pares posibles entre 5) para cubrirlos todos. **A ciegas:** ninguno ve el registro del otro hasta que ambos registran. Si coinciden, queda ese; si no, el motivo pasa a **«Desacuerdo entre verificadores»** (lista del admin, que decide). Mientras tanto cuenta como pendiente para las métricas. Avance muestra % de acuerdo y kappa por persona cuando haya ≥ 30 motivos dobles. **Requiere backend:** un registro por verificador en esas llamadas + uno oficial. | Sin doble asignación; al final el admin re-verifica una muestra de 30 por persona. |
| V8 | ¿Cómo se ve el split del golden set? | El verificador **no lo ve** (ni filtro ni etiqueta): no cambia lo que debe hacer y evita tratar distinto las de prueba. Se verifican los tres sets (corrigen la referencia en todos). El reparto estratifica por split, así cada persona tiene ~60/20/20. El admin ve el desglose por split en la tabla de avance (`Por segmento · Por split`). Orden de trabajo: el aleatorio fijo actual, sin priorizar un set. | Priorizar validación y prueba primero, para poder medir v2.15 antes. |
| V9 | ¿Puede el verificador corregir lo registrado? | Sí, sus propios registros, sin plazo (se guarda quién y cuándo). No puede tocar los de otros. El admin puede corregir cualquiera. En los dobles, cambiar el registro después de ver el del otro no se permite (botones bloqueados con «Ya se comparó con otro verificador»). | Registros cerrados una vez hechos; solo el admin corrige. |

## Textos nuevos (para `verification-labels.ts`)

- Rol: `Verificador`. Menú: `Verificación`.
- Filtro: `Asignadas a:` · `Mí` · `Todas` (admin: `Todos` · `{nombre}` · `Sin asignar`).
- Tarjeta: `Te quedan {d} de {n} llamadas` · `Seguir revisando` · sin pendientes: `¡Listo! Completaste tus {n} llamadas.`
- Aviso: `Esta llamada está asignada a {nombre}. Puedes verla, pero no registrar.`
- Sin desacuerdos: `Sin observaciones` · `Deshacer` · `Revisada sin observaciones por {nombre} el {fecha}.`
- Admin: `Verificadores` · `Repartir llamadas` · `Repartir {N} llamadas` · `Pasar pendientes a…`.
- (Fuera de alcance por V7: textos de doble asignación y «Desacuerdo entre verificadores».)

## Supuestos

- **H-V1 [SUPUESTO]:** los 5 verificadores conocen la pauta igual que el admin; no necesitan una guía nueva más allá de la revisión actual.
- **H-V2 [SUPUESTO]:** de ~1.100 llamadas, la mayoría tiene al menos un motivo en desacuerdo (≈ 180-220 por persona). Se confirma con un conteo sin IA al terminar la corrida.
- **H-V3 [SUPUESTO]:** la pantalla de revisión actual sirve tal cual en los equipos de los verificadores (≥ 1280 px).

## Riesgos

- **R-V1:** el nombre «Posible error del revisor» (viene de la IA de análisis) puede sesgar al verificador hacia «Error del revisor». Si se quiere evitar, se oculta el segmento al verificador; hoy no se propone para mantener la paridad con el admin que pidió Johannes.
- **R-V2:** ~~V7 A cambia el modelo~~ Cerrado: V7 fuera de alcance, el modelo de registros no cambia.
- **R-V5:** con V1 B, las llamadas de acuerdo total son mayoría probable; el riesgo es marcarlas `Sin observaciones` sin escucharlas. Se mitiga mostrando el tiempo en la llamada en la tabla de avance solo si Johannes lo pide (no propuesto).
- **R-V3:** si se reparte antes de que termine la corrida v2.15, las llamadas sin resultado no tienen segmento y el estrato queda mal. Por eso V1 reparte después; las llamadas que lleguen más tarde se reparten con otro `Repartir llamadas`.
- **R-V4:** dos personas en la misma llamada no asignada no es posible con V4 A; con V4 B habría que bloquear la toma simultánea.
