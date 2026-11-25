// Migra la base de producción (Supabase) con las variables de backend/.env.produccion,
// sin imprimirlas. Después de migrar activa RLS en todas las tablas (las nuevas
// nacen sin él) y quita los permisos de los roles públicos de Supabase.
//
//   npm run migrar-produccion             → solo muestra el estado (prisma migrate status)
//   npm run migrar-produccion -- --aplicar → aplica las migraciones pendientes
//
// La app entra con el rol postgres, que se salta RLS: no le afecta.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const archivo = path.resolve('.env.produccion');
if (!fs.existsSync(archivo)) {
  console.error('Falta backend/.env.produccion (DATABASE_URL y DIRECT_URL de Supabase).');
  process.exit(1);
}
const vars = dotenv.parse(fs.readFileSync(archivo));
for (const k of ['DATABASE_URL', 'DIRECT_URL']) {
  if (!vars[k]?.includes('supabase')) {
    console.error(`${k} de .env.produccion no apunta a Supabase: no sigo.`);
    process.exit(1);
  }
}
const env = { ...process.env, DATABASE_URL: vars.DATABASE_URL, DIRECT_URL: vars.DIRECT_URL };
const aplicar = process.argv.includes('--aplicar');

const ocultar = (s) => s.replace(/postgres(ql)?:\/\/\S+/g, '<oculto>');
const r = spawnSync('npx', ['prisma', 'migrate', aplicar ? 'deploy' : 'status'], { env, shell: true, encoding: 'utf8' });
process.stdout.write(ocultar(r.stdout ?? ''));
process.stderr.write(ocultar(r.stderr ?? ''));
if (!aplicar || r.status !== 0) process.exit(r.status ?? 1);

const prisma = new PrismaClient({ datasources: { db: { url: vars.DIRECT_URL } } });
try {
  const tablas = await prisma.$queryRawUnsafe("select tablename from pg_tables where schemaname = 'public'");
  for (const { tablename } of tablas) {
    await prisma.$executeRawUnsafe(`alter table public."${tablename}" enable row level security`);
  }
  for (const tipo of ['tables', 'sequences', 'functions']) {
    await prisma.$executeRawUnsafe(`revoke all on all ${tipo} in schema public from anon, authenticated`);
  }
  console.log(`RLS activo en ${tablas.length} tablas; sin permisos para anon/authenticated.`);
} finally {
  await prisma.$disconnect();
}
