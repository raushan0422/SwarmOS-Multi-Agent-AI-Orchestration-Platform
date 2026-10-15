/**
 * SwarmOS Full-Stack Server
 * Express application mounting SwarmOS API router and Vite development middlewares on port 3000.
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './server/routes/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', platform: 'SwarmOS', timestamp: new Date().toISOString() });
  });

  if (!isProduction) {
    // Mount Vite dev middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SwarmOS Control Plane running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal: Failed to start SwarmOS server:', err);
  process.exit(1);
});
