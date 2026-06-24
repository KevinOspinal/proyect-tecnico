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
 * CASO DE MEDIANOCHE (ver comentario en el bucle de generación):
 * Si hourCali >= 19, la conversión a UTC produce una hora >= 24:00,
 * lo que JavaScript traduce automáticamente al día siguiente.
 * Ejemplo: 22:00 Cali + 5h = 27:00 UTC → 03:00 UTC del día siguiente.
 */
function makeCaliTime(baseDate, hourCali, minuteCali = 0) {
  const d = new Date(baseDate);
  d.setUTCHours(0, 0, 0, 0); // normalizar a medianoche UTC
  d.setUTCHours(hourCali + 5, minuteCali, 0, 0); // JS ajusta la fecha automáticamente si >= 24h
  return d;
}

// ─── Generación de interacciones ──────────────────────────────────────────────

function generarInteracciones(agentes) {
  const interacciones = [];

  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hoy.getDate() - 30);

  for (let i = 0; i < 350; i++) {
    const agente = randomItem(agentes);
    const tipo = randomItem(['llamada', 'ticket']);

    // Día aleatorio dentro del rango de 30 días
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
     * Si la query usara date_trunc sobre UTC sin conversión, estas ~140
     * interacciones quedarían asignadas al día equivocado y los totales no cuadrarían.
     */
    if (i % 10 < 4) {
      openedAt = makeCaliTime(fechaBase, randomInt(19, 23), randomInt(0, 59));
    } else {
      // Horario de oficina normal en Cali (6 a.m. – 6 p.m.)
      openedAt = makeCaliTime(fechaBase, randomInt(6, 18), randomInt(0, 59));
    }

    // Distribución de estados: 60% resuelta, 20% en_progreso, 20% abierta
    const rand = Math.random();
    let status, closedAt;

    if (rand < 0.6) {
      status = 'resuelta';
      // Duración realista: llamadas 5–45 min, tickets 30 min – 4 horas
      const duracionMs =
        tipo === 'llamada'
          ? randomInt(5, 45) * 60 * 1000
          : randomInt(30, 240) * 60 * 1000;
      closedAt = new Date(openedAt.getTime() + duracionMs);
    } else if (rand < 0.8) {
      status = 'en_progreso';
      closedAt = null;
    } else {
      status = 'abierta';
      closedAt = null;
    }

    interacciones.push({ agentId: agente.id, type: tipo, status, openedAt, closedAt });
  }

  return interacciones;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Limpiando datos existentes...');
  // El orden importa: interactions referencia agents por FK
  await prisma.interaction.deleteMany();
  await prisma.agent.deleteMany();

  console.log('Creando agentes...');
  const agentes = await Promise.all(
    AGENTES_DATA.map((a) => prisma.agent.create({ data: a }))
  );

  console.log('Generando interacciones...');
  const interacciones = generarInteracciones(agentes);

  // createMany inserta en un solo round-trip a la BD
  await prisma.interaction.createMany({ data: interacciones });

  // ── Resumen ──
  const resueltas    = interacciones.filter((i) => i.status === 'resuelta').length;
  const enProgreso   = interacciones.filter((i) => i.status === 'en_progreso').length;
  const abiertas     = interacciones.filter((i) => i.status === 'abierta').length;
  // Interacciones nocturnas: las que en UTC caen entre 00:00 y 04:59 (= 19:00-23:59 Cali)
  const nocturnas    = interacciones.filter((i) => i.openedAt.getUTCHours() < 5).length;

  console.log(`\n Agentes creados   : ${agentes.length}`);
  console.log(` Interacciones     : ${interacciones.length}`);
  console.log(`   → resueltas     : ${resueltas}`);
  console.log(`   → en progreso   : ${enProgreso}`);
  console.log(`   → abiertas      : ${abiertas}`);
  console.log(`   → nocturnas Cali (19-23h → 00-04h UTC): ${nocturnas}`);
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
