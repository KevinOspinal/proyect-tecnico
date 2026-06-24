import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS,
  puedeTransicionar,
  debeEstamparClosedAt,
} from '../src/domain/interactionStatus.js';

describe('puedeTransicionar — transiciones válidas', () => {
  it('abierta → en_progreso', () => {
    assert.equal(puedeTransicionar(STATUS.abierta, STATUS.en_progreso), true);
  });

  it('abierta → resuelta (salto directo permitido)', () => {
    assert.equal(puedeTransicionar(STATUS.abierta, STATUS.resuelta), true);
  });

  it('en_progreso → resuelta', () => {
    assert.equal(puedeTransicionar(STATUS.en_progreso, STATUS.resuelta), true);
  });
});

describe('puedeTransicionar — transiciones inválidas', () => {
  it('resuelta → cualquier cosa (estado terminal)', () => {
    assert.equal(puedeTransicionar(STATUS.resuelta, STATUS.abierta), false);
    assert.equal(puedeTransicionar(STATUS.resuelta, STATUS.en_progreso), false);
    assert.equal(puedeTransicionar(STATUS.resuelta, STATUS.resuelta), false);
  });

  it('en_progreso → abierta (retroceso prohibido)', () => {
    assert.equal(puedeTransicionar(STATUS.en_progreso, STATUS.abierta), false);
  });

  it('estado origen desconocido devuelve false sin lanzar', () => {
    assert.equal(puedeTransicionar('estado_inventado', STATUS.resuelta), false);
  });
});

describe('debeEstamparClosedAt', () => {
  it('devuelve true solo cuando el destino es resuelta', () => {
    assert.equal(debeEstamparClosedAt(STATUS.resuelta), true);
  });

  it('devuelve false para cualquier otro estado', () => {
    assert.equal(debeEstamparClosedAt(STATUS.abierta), false);
    assert.equal(debeEstamparClosedAt(STATUS.en_progreso), false);
  });
});
