export const STATUS = {
  abierto:    'abierto',
  proceso:    'proceso',
  finalizado: 'finalizado',
};

const TRANSICIONES = {
  [STATUS.abierto]:    [STATUS.proceso, STATUS.finalizado],
  [STATUS.proceso]:    [STATUS.finalizado],
  [STATUS.finalizado]: [],
};

export function puedeTransicionar(desde, hacia) {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

export function debeEstamparClosedAt(hacia) {
  return hacia === STATUS.finalizado;
}

export function debeEstamparInProgressAt(hacia) {
  return hacia === STATUS.proceso;
}
