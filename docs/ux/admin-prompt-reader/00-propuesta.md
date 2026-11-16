# Leer el prompt · pestaña de lectura en el detalle de versión

**Tipo:** cambio menor sobre una pantalla interna aprobada (`admin/prompts/[version]`). Revisión rápida: brief, propuesta y wireframe en texto en un solo gate. Sin investigación ni personas (único usuario: Johannes, admin).
**Fecha:** 2026-11-15 · **Estado:** esperando aprobación de L1-L5.

## 1. Brief

- **Pedido (textual):** "cuando yo me ponga sobre un prompt, haya una opción de leer de forma ordenada y no tediosa, quizas tipo md o algo así, el yaml, ya que solo vemos la diferencia entre uno y otro."
- **P-01:** hoy el prompt solo se ve como diff contra la vigente. En la vigente no se ve nada ("Esta es la versión vigente…"). Para leer el prompt completo hay que abrir `prompt.yaml` (unas 950 líneas, 69 reglas, 33 motivos) en el editor.
- **P-02:** el YAML mezcla lo que lee la IA (el texto) con metadatos (`history`, `origins`). Leerlo crudo cansa.
- **P-03:** en los motivos, el texto oficial de la corredora y la aclaración de Qubico (`official` / `criterion`) vienen de lugares distintos y no pesan lo mismo, pero en el YAML se ven iguales.
- **Objetivo:** leer cualquier versión (la vigente también) como un documento, de corrido, y llegar rápido a una sección o a un motivo.
- **Éxito:** Johannes lee una versión sin abrir el YAML. [SUPUESTO: no se mide, se valida con su uso.]
- **Fuera de alcance:** editar desde la lectura (para eso está "Editar borrador"), comparar dos versiones cualquiera, exportar a PDF o MD.

## 2. Propuesta

Una pestaña nueva, **"Leer"**, en `prompt-version.tsx`, la primera de la lista. Componente nuevo `components/admin/prompt-reader.tsx`.

### Requisitos

| ID | Requisito | Traza |
|---|---|---|
| R-01 | La pestaña aparece en todas las versiones: vigente, borrador y archivadas | P-01 |
| R-02 | Índice de secciones (los `heading` del YAML) con enlaces ancla. Para la pauta, un acceso "Ir a motivo" con los números 1 a 33 | P-01 |
| R-03 | Cada sección muestra su `heading` como título real, sin los `##`. El nivel (`##` o `###`) define la jerarquía h2/h3. La sección `intro`, que no trae heading, se titula "Introducción" | P-02 |
| R-04 | Cada regla es un bloque: id discreto (mono, chico: `r5`, `m31`) y su texto. Los motivos se titulan "Motivo 31" | P-02 |
| R-05 | Motivos con `official` y `criterion`: dos partes rotuladas, "Texto oficial" y "Criterio Qubico" (ver L2). El criterio lleva borde izquierdo de acento y rótulo, para que no dependa solo del color | P-03 |
| R-06 | Historial y origen plegados (`<details>`) bajo cada regla, con resumen de una línea: "Historial · 3 cambios · último v2.1 (Script del cliente)". Al abrirlo: tabla versión / origen (el `label` de `origins`) / nota | P-02 |
| R-07 | Texto reflujado: se unen las líneas cortadas por el ancho del YAML; se mantienen las líneas en blanco, las listas (`-`, `1.`) y las sangrías de continuación | P-02 |
| R-08 | `json_output_instruction` al final, plegado, con el título "Formato de respuesta sin herramientas" | P-02 |
| R-09 | Si `meta.source === "text"` no hay estructura: se muestra el system prompt como texto (las líneas `## ` como títulos y el resto reflujado), junto al banner que ya existe ("sin historial ni origen por regla") | R-01 |
| R-10 | Si el YAML no se puede leer: "No se pudo leer el prompt como YAML. Se muestra como texto." y se cae al modo de R-09 | — |
| R-11 | Deep link `?tab=read` (igual que `?tab=test`) y anclas por sección y regla (`#rules`, `#m31`) | R-02 |

### Recomendación técnica (para el dev; Johannes no tiene que decidirla)

El front no tiene una librería de YAML. Lo más simple para un equipo backend-first es que el endpoint de detalle entregue también `parsed` (el `spec` que `prompt_registry.py` ya carga) y que el front solo lo renderice. La alternativa es agregar el paquete `yaml` al front.

## 3. Wireframe (texto)

```
[ Leer ] [ Diferencias ] [ Prueba ] [ Historial ] [ Editar borrador ]  Verificación
-------------------------------------------------------------------------------------
 v2.10 · 2026-10-22 · 69 reglas                          [Expandir historiales] (L4)
-------------------------------------------------------------------------------------
 ÍNDICE (sticky, ~220px)  |  Introducción
  Introducción            |    intro  Eres un auditor de calidad de BancoEstado ...
  Datos que recibes       |           Actores: el CLIENTE es ...
  Reglas de evaluación    |           > Historial · 1 cambio · base (Diseño Qubico)
  Definiciones            |
  Pauta de calidad        |  Reglas de evaluación
    A. Acreditación       |    r1  1. Evalúa SOLO con la transcripción ...
    B. Conocimiento       |        > Historial · 1 cambio · base (Diseño Qubico)
    C. Gestión retención  |    r2  2. Cada motivo "incumple" lleva ...
    D. Trato              |
    E. Tipificación       |  Pauta de calidad › A. Acreditación y protocolo
  Motivos de renuncia     |   ┌ Motivo 31                     [Cambió en v2.10] (L3)
  Formato sin herram.     |   │ TEXTO OFICIAL
                          |   │ No valida correctamente al cliente, (Rut, Nombre,
  Ir a motivo             |   │ Fecha Nacimiento). Protocolo de acreditación titularidad.
  [1] [2] ... [33]        |   │ ┃ CRITERIO QUBICO
                          |   │ ┃ debe corroborar sí o sí los 3 datos. También incumple ...
                          |   │ > Historial · 3 cambios · último v2.1 (Script del cliente)
                          |   └
```

- Columna de texto de unos 72 caracteres de ancho, para que se lea cómodo.
- Bajo 768 px el índice pasa arriba como un select "Ir a sección".
- Opcional: marcar en el índice la sección visible (`aria-current`). Si complica, bastan las anclas.

## 4. Revisión rápida

| Chequeo | Resultado |
|---|---|
| Patrones | Otra pestaña en el `.tabs` que ya existe; índice más documento largo (patrón de documentación); `<details>` nativo para mostrar el detalle solo cuando se pide. Sin componentes nuevos de librería |
| Navegación | `?tab=read` y anclas para compartir o volver a un punto |
| Accesibilidad WCAG 2.2 AA | Títulos h2/h3 reales, no divs; índice como `<nav aria-label="Secciones del prompt">`; `<details>/<summary>` operable con teclado; "Texto oficial" y "Criterio Qubico" rotulados con texto (1.4.1); contraste con los tokens existentes; foco visible en las anclas; `scroll-margin-top` para que el título no quede tapado por headers sticky al saltar (2.4.11) |
| Microcopy y glosario | "Leer" (verbo corto, va con "Editar borrador"); "Texto oficial" es el mismo `label` de `origins.official_text`; "Historial" se usa también en la pestaña de la versión, pero dentro de una regla el contexto lo distingue |
| Dark patterns / legal | No aplica: pantalla interna y, por indicación de Johannes, por ahora no se levantan temas legales |

## 5. Decisiones para Johannes

- **L1. Pestaña por defecto.** Recomiendo "Leer" por defecto en la vigente (hoy su "Diferencias" sale vacía) y "Diferencias" por defecto en las demás versiones, donde lo que importa es qué cambió. Alternativa: "Leer" siempre por defecto.
- **L2. Rótulo de la aclaración.** "Criterio Qubico" (deja claro que es nuestro, sobre el texto de la corredora) o "Criterio" (como aparece hoy en el prompt que lee la IA). Recomiendo "Criterio Qubico".
- **L3. Marcar lo que cambió en esta versión.** Un badge "Cambió en v2.10" en las reglas cuyo historial incluye la versión abierta, y un filtro "Solo lo que cambió". Recomiendo el badge sí y el filtro no, porque para eso está Diferencias.
- **L4. Historial.** Plegado por regla, con resumen de una línea y un botón global "Expandir historiales"; o sacar el historial de esta vista y dejar solo el texto. Recomiendo plegado con botón.
- **L5. Buscador.** Recomiendo no hacerlo en v1: como todo el texto está en pantalla, el Ctrl+F del navegador funciona (Chrome abre los `<details>` cuando encuentra algo adentro), y queda el "Ir a motivo". Si lo quieres, sería un campo que filtra reglas por texto o id y resalta las coincidencias.
