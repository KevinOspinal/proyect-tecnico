import { PrismaClient } from '@prisma/client';

// Instancia única compartida — crear múltiples PrismaClient agota el pool de conexiones
const prisma = new PrismaClient();

export default prisma;
