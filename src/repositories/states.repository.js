import prisma from '../config/prisma.js';

export async function findAll() {
  return prisma.state.findMany({ orderBy: { id: 'asc' } });
}
