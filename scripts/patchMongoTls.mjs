/**
 * Patches the MongoDB driver's cmap/connect.js to require our CF Workers-compatible
 * TLS shim instead of the native node:tls polyfill, which hangs in Workers.
 *
 * Run this after `npm ci` in CI, before `wrangler pages deploy`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const connectJsPath = resolve(__dirname, '../node_modules/mongodb/lib/cmap/connect.js');

if (!existsSync(connectJsPath)) {
  console.error('[patchMongoTls] connect.js not found:', connectJsPath);
  process.exit(1);
}

let content = readFileSync(connectJsPath, 'utf8');

// Relative from node_modules/mongodb/lib/cmap/ → project root → functions/_shared/
// Use the ESM shim (.js) so esbuild lifts `import 'cloudflare:sockets'` to a
// top-level native import; the CJS shim uses require() which fails for CF built-ins.
const shimPath = '../../../../functions/_shared/tls-cf-shim.js';
const original = 'const tls = require("tls");';
const patched  = `const tls = require("${shimPath}");`;

if (content.includes(patched) || content.includes('tls-cf-shim')) {
  console.log('[patchMongoTls] Already patched — skipping.');
  process.exit(0);
}

if (!content.includes(original)) {
  console.error('[patchMongoTls] Target line not found. Has the MongoDB driver been updated?');
  console.error('[patchMongoTls] Expected:', original);
  process.exit(1);
}

content = content.replace(original, patched);
writeFileSync(connectJsPath, content, 'utf8');
console.log('[patchMongoTls] Patched node:tls → CF Workers shim in:', connectJsPath);
