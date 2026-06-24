import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS,
  puedeTransicionar,
  debeEstamparClosedAt,
  debeEstamparInProgressAt,
} from '../src/domain/interactionStatus.js';

describe('puedeTransicionar — transiciones válidas', () => {
  it('abierto → proceso', () => {
    assert.equal(puedeTransicionar(STATUS.abierto, STATUS.proceso), true);
  });

  it('abierto → finalizado (salto directo permitido)', () => {
    assert.equal(puedeTransicionar(STATUS.abierto, STATUS.finalizado), true);
  });

  it('proceso → finalizado', () => {
    assert.equal(puedeTransicionar(STATUS.proceso, STATUS.finalizado), true);
  });
});

describe('puedeTransicionar — transiciones inválidas', () => {
  it('finalizado → cualquier cosa (estado terminal)', () => {
    assert.equal(puedeTransicionar(STATUS.finalizado, STATUS.abierto), false);
    assert.equal(puedeTransicionar(STATUS.finalizado, STATUS.proceso), false);
    assert.equal(puedeTransicionar(STATUS.finalizado, STATUS.finalizado), false);
  });

  it('proceso → abierto (retroceso prohibido)', () => {
    assert.equal(puedeTransicionar(STATUS.proceso, STATUS.abierto), false);
  });

  it('estado origen desconocido devuelve false sin lanzar', () => {
    assert.equal(puedeTransicionar('estado_inventado', STATUS.finalizado), false);
  });
});

describe('debeEstamparClosedAt', () => {
  it('devuelve true solo cuando el destino es finalizado', () => {
    assert.equal(debeEstamparClosedAt(STATUS.finalizado), true);
  });

  it('devuelve false para cualquier otro estado', () => {
    assert.equal(debeEstamparClosedAt(STATUS.abierto), false);
    assert.equal(debeEstamparClosedAt(STATUS.proceso), false);
  });
});

describe('debeEstamparInProgressAt', () => {
  it('devuelve true solo cuando el destino es proceso', () => {
    assert.equal(debeEstamparInProgressAt(STATUS.proceso), true);
  });

  it('devuelve false para cualquier otro estado', () => {
    assert.equal(debeEstamparInProgressAt(STATUS.abierto), false);
    assert.equal(debeEstamparInProgressAt(STATUS.finalizado), false);
  });
});
