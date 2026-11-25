import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// DIRECT_URL solo la usan las migraciones. Donde no se cargó (pruebas en la VPS,
// sin pooler), se usa la misma DATABASE_URL para que la app no falle al arrancar.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export const prisma = new PrismaClient();
