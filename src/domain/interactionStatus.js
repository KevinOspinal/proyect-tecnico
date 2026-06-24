/**
 * Máquina de estados para Interaction.
 *
 * Estados válidos y sus transiciones permitidas:
 *   abierta     → en_progreso, resuelta
 *   en_progreso → resuelta
 *   resuelta    → (ninguna — estado terminal)
 *
 * Esta lógica no importa Express ni Prisma; vive aquí para que
 * cualquier entrada del sistema (HTTP, colas, scripts) la reutilice.
 */

// Constantes — evitan strings sueltos dispersos por el código
export const STATUS = {
  abierta: 'abierta',
  en_progreso: 'en_progreso',
  resuelta: 'resuelta',
};

// Mapa de transiciones válidas por estado de origen
const TRANSICIONES = {
  [STATUS.abierta]: [STATUS.en_progreso, STATUS.resuelta],
  [STATUS.en_progreso]: [STATUS.resuelta],
  [STATUS.resuelta]: [], // estado terminal
};

/**
 * Devuelve true si la transición de `desde` → `hacia` es válida.
 * Es una función pura: sin efectos secundarios, sin dependencias externas.
 *
 * @param {string} desde - Estado actual de la interacción
 * @param {string} hacia - Estado al que se quiere mover
 * @returns {boolean}
 */
export function puedeTransicionar(desde, hacia) {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

/**
 * Indica si una transición hacia `hacia` requiere estampar closedAt.
 * Solo se estampa cuando la interacción pasa a 'resuelta'.
 *
 * @param {string} hacia - Estado destino de la transición
 * @returns {boolean}
 */
export function debeEstamparClosedAt(hacia) {
  return hacia === STATUS.resuelta;
}
