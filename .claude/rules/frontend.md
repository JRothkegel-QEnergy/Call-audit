---
paths:
  - "frontend/**"
---

# Frontend

- Next.js + React + TypeScript estricto. Componentes, rutas e identificadores en inglés; textos de la UI en español.
- Vistas principales: cola del auditor, detalle de llamada, dashboard del supervisor, editor de rúbrica, operación Qubico.
- **Cola del auditor**: ordenada por gravedad, con atajos de teclado para confirmar / corregir / siguiente. La corrección exige un motivo de una lista cerrada.
- **Detalle de llamada**: audio sincronizado con la transcripción; cada ítem del checklist enlaza a su evidencia (timestamp) y salta el audio a ese punto.
- Mostrar siempre que el resultado es un **hallazgo** pendiente de revisión humana, nunca una sanción.
- No mostrar PII sin necesidad; respetar permisos por rol (auditor, supervisor, admin de calidad, operación).
