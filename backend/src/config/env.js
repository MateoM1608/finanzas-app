import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Falta la variable de entorno ${key}`);
  }
}

// Un secreto corto se puede adivinar por fuerza bruta y falsificar sesiones.
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET tiene menos de 32 caracteres: usa uno más largo y aleatorio');
}

export const env = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
};
