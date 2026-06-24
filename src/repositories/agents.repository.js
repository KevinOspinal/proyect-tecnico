import prisma from '../config/prisma.js';

// Busca un agente por su id; devuelve null si no existe
export async function findById(id) {
  return prisma.agent.findUnique({ where: { id } });
}

// Busca un agente por email; usado para detectar duplicados antes de crear
export async function findByEmail(email) {
  return prisma.agent.findUnique({ where: { email } });
}

// Crea un agente nuevo y devuelve el registro creado
export async function crear(data) {
  return prisma.agent.create({ data });
}

// Devuelve todos los agentes ordenados por nombre
export async function listar() {
  return prisma.agent.findMany({ orderBy: { name: 'asc' } });
}
