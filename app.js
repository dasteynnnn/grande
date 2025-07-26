import express from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config();

const app = express();
app.use(morgan('dev'));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.join(__dirname, 'routes');

async function loadRoutesRecursively(dir, baseRoute = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const routeFileName = `${entry.name}.js`;
      const routeFilePath = path.join(fullPath, routeFileName);

      if (fs.existsSync(routeFilePath)) {
        const routeModule = await import(pathToFileURL(routeFilePath).href);
        const routeBase = `${baseRoute}/${entry.name}`;
        app.use(`/api${routeBase}`, routeModule.default);
      } else {
        await loadRoutesRecursively(fullPath, `${baseRoute}/${entry.name}`);
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.js') &&
      entry.name !== `${path.basename(dir)}.js`
    ) {
      const routeModule = await import(pathToFileURL(fullPath).href);
      const routeBase = `${baseRoute}/${entry.name.replace('.js', '')}`;
      app.use(`/api${routeBase}`, routeModule.default);
    }
  }
}

// Load all routes first
await loadRoutesRecursively(routesDir);

// Print all registered routes with HTTP methods
console.log('\n🚀 Available API endpoints:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // Top-level route (rare in your case)
    const methods = Object.keys(middleware.route.methods)
      .map((m) => m.toUpperCase())
      .join(', ');
    console.log(`${methods} ${middleware.route.path}`);
  } else if (middleware.name === 'router' && middleware.handle.stack) {
    // Nested router (like /api/v1/user)
    const routeBase = middleware.regexp?.source
      ?.replace('^\\/', '/')            // starts with /
      ?.replace('\\/?(?=\\/|$)', '')    // remove trailing regex
      ?.replace(/\\\//g, '/')           // convert \/ to /
      ?.replace(/\$$/, '')              // remove trailing $
      ?.replace(/^\/api/, '') || '';    // avoid double /api

    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const methods = Object.keys(handler.route.methods)
          .map((m) => m.toUpperCase())
          .join(', ');
        const fullPath = `/api${routeBase}${handler.route.path}`;
        console.log(`${methods} ${fullPath}`);
      }
    });
  }
});
console.log('');

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;