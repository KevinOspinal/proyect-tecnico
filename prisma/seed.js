import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Datos de agentes ─────────────────────────────────────────────────────────

const AGENTES_DATA = [
  { name: 'Valentina Ríos',       email: 'valentina.rios@wekall.co' },
  { name: 'Sebastián Mora',       email: 'sebastian.mora@wekall.co' },
  { name: 'Camila Herrera',       email: 'camila.herrera@wekall.co' },
  { name: 'Andrés Castillo',      email: 'andres.castillo@wekall.co' },
  { name: 'Luisa Fernanda Gómez', email: 'luisa.gomez@wekall.co' },
  { name: 'Felipe Torres',        email: 'felipe.torres@wekall.co' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Crea un Date en UTC que representa la hora `hourCali:minuteCali` en Colombia (UTC-5).
 * Colombia no usa horario de verano, siempre es UTC-5.
 *
 * CASO DE MEDIANOCHE: si hourCali >= 19, la conversión a UTC produce una hora >= 24:00,
 * lo que JavaScript traduce automáticamente al día siguiente.
 * Ejemplo: 22:00 Cali + 5h = 27:00 UTC → 03:00 UTC del día siguiente.
 */
function makeCaliTime(baseDate, hourCali, minuteCali = 0) {
  const d = new Date(baseDate);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCHours(hourCali + 5, minuteCali, 0, 0);
  return d;
}

// ─── Generación de interacciones ──────────────────────────────────────────────

function generarInteracciones(agentes, estados) {
  const idAbierto    = estados.find((s) => s.name === 'abierto').id;
  const idProceso    = estados.find((s) => s.name === 'proceso').id;
  const idFinalizado = estados.find((s) => s.name === 'finalizado').id;

  const interacciones = [];

  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hoy.getDate() - 30);

  for (let i = 0; i < 350; i++) {
    const agente = randomItem(agentes);
    const tipo = randomItem(['llamada', 'ticket']);

    const fechaBase = new Date(hace30Dias);
    fechaBase.setDate(hace30Dias.getDate() + randomInt(0, 29));

    let openedAt;

    /**
     * CASO DE MEDIANOCHE — ~40% de las interacciones
     *
     * Se generan con hora Cali entre 19:00 y 23:59 (horario nocturno).
     * En UTC esas horas son 00:00–04:59 del DÍA SIGUIENTE.
     *
     * Propósito: verificar que la query de métricas agrupa estas interacciones
     * en el día Cali correcto (día D) y no en el día UTC (día D+1).
     */
    if (i % 10 < 4) {
      openedAt = makeCaliTime(fechaBase, randomInt(19, 23), randomInt(0, 59));
    } else {
      openedAt = makeCaliTime(fechaBase, randomInt(6, 18), randomInt(0, 59));
    }

    // Distribución: 60% finalizado, 20% proceso, 20% abierto
    const rand = Math.random();
    let stateId, inProgressAt, closedAt;

    if (rand < 0.6) {
      stateId = idFinalizado;
      const duracionMs =
        tipo === 'llamada'
          ? randomInt(5, 45) * 60 * 1000
          : randomInt(30, 240) * 60 * 1000;
      inProgressAt = new Date(openedAt.getTime() + randomInt(1, 3) * 60 * 1000);
      closedAt     = new Date(openedAt.getTime() + duracionMs);
    } else if (rand < 0.8) {
      stateId      = idProceso;
      inProgressAt = new Date(openedAt.getTime() + randomInt(1, 5) * 60 * 1000);
      closedAt     = null;
    } else {
      stateId      = idAbierto;
      inProgressAt = null;
      closedAt     = null;
    }

    interacciones.push({ agentId: agente.id, type: tipo, stateId, openedAt, inProgressAt, closedAt });
  }

  return interacciones;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Limpiando datos existentes...');
  await prisma.interaction.deleteMany();
  await prisma.agent.deleteMany();

  console.log('Creando agentes...');
  const agentes = await Promise.all(
    AGENTES_DATA.map((a) => prisma.agent.create({ data: a }))
  );

  console.log('Cargando estados desde la BD...');
  const estados = await prisma.state.findMany();

  console.log('Generando interacciones...');
  const interacciones = generarInteracciones(agentes, estados);

  await prisma.interaction.createMany({ data: interacciones });

  const idFinalizado = estados.find((s) => s.name === 'finalizado').id;
  const idProceso    = estados.find((s) => s.name === 'proceso').id;
  const idAbierto    = estados.find((s) => s.name === 'abierto').id;

  const finalizadas = interacciones.filter((i) => i.stateId === idFinalizado).length;
  const enProceso   = interacciones.filter((i) => i.stateId === idProceso).length;
  const abiertas    = interacciones.filter((i) => i.stateId === idAbierto).length;
  const nocturnas   = interacciones.filter((i) => i.openedAt.getUTCHours() < 5).length;

  console.log(`\n Agentes creados   : ${agentes.length}`);
  console.log(` Interacciones     : ${interacciones.length}`);
  console.log(`   → finalizadas   : ${finalizadas}`);
  console.log(`   → en proceso    : ${enProceso}`);
  console.log(`   → abiertas      : ${abiertas}`);
  console.log(`   → nocturnas Cali (19-23h → 00-04h UTC): ${nocturnas}`);
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
