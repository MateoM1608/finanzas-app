// Entrada para Vercel: la app de Express se exporta como función serverless.
// `src/server.js` (con app.listen) sigue siendo la entrada para correr local.
import { app } from '../src/app.js';

export default app;
