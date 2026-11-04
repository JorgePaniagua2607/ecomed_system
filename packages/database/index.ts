import { PrismaClient } from '@prisma/client';

// Extraemos las variables de entorno evadiendo el chequeo global de TS
const env = (globalThis as any).process.env;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';