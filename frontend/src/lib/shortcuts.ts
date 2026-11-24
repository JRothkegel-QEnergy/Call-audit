/**
 * Atajos de teclado globales (J/K, 1-2, C, A/D, espacio, flechas del audio...). Desactivados en todas las vistas por
 * pedido de Johannes (docs/ux/admin-prompt-metrics/22, AE10). Los listeners siguen en el código y se cortan con esta
 * constante, para poder volver a activarlos sin reescribirlos. Enter sobre filas y flechas en tablist/segmented no son
 * atajos: son teclado nativo (WCAG 2.1.1) y siguen activos.
 */
export const SHORTCUTS_ENABLED = false;
