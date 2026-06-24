import * as statesRepo from '../repositories/states.repository.js';

export async function listarEstados() {
  return statesRepo.findAll();
}
