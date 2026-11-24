// Compila la extensión de navegador de Nexor a extension/dist/{chrome,firefox}.
//   npm run ext:build           → carpetas listas para "Cargar descomprimida"
//   npm run ext:zip             → además genera los .zip para las tiendas
// Un único código para Chrome/Edge/Brave (MV3 con service worker) y Firefox
// (MV3 con background scripts); solo cambia el manifest.

import { build } from 'esbuild';
import sharp from 'sharp';
import { zipSync } from 'fflate';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
// --publish: deja los .zip en public/downloads para descargarlos desde la app (se usa en el build de producción; si algo falla no rompe el despliegue)
const publish = process.argv.includes('--publish');
const wantZip = process.argv.includes('--zip') || publish;

// --custom-server: permite al usuario elegir otro servidor (instalaciones propias). La versión de las
// tiendas NO lo incluye: pide un único permiso de host (el servidor de Nexor) y se revisa más rápido.
// (Ahora el permiso opcional de sitios web va siempre declarado, así que el flag ya no cambia el manifest.)
const serverArg = process.argv.find((a) => a.startsWith('--server='));
const SERVER_ORIGIN = serverArg ? new URL(serverArg.slice('--server='.length)).origin : 'https://software-nexor.p08ks6.easypanel.host';

const common = {
  manifest_version: 3,
  name: 'Nexor Vault',
  short_name: 'Nexor',
  version: pkg.version,
  description: 'Rellena tus contraseñas y códigos 2FA de Nexor con un clic. Zero-knowledge: se descifra todo en tu navegador.',
  icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  action: {
    default_title: 'Nexor Vault',
    default_popup: 'popup.html',
    default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
  },
  // Permisos mínimos: nada de "leer todas las webs". El relleno solo se inyecta
  // en la pestaña activa cuando el usuario lo pide (activeTab + scripting).
  permissions: ['storage', 'alarms', 'activeTab', 'scripting'],
  host_permissions: [`${SERVER_ORIGIN}/*`],
  // Permiso OPCIONAL: solo se pide si el usuario activa "ofrecer guardar contraseñas". Sin él, la extensión no puede ver ninguna web.
  optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
  homepage_url: SERVER_ORIGIN,
  commands: {
    'fill-login': {
      suggested_key: { default: 'Alt+Shift+L', mac: 'Alt+Shift+L' },
      description: 'Rellenar el inicio de sesión de esta web',
    },
    _execute_action: {
      suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
      description: 'Abrir Nexor Vault',
    },
  },
  content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; base-uri 'none'" },
};

const manifests = {
  chrome: {
    ...common,
    minimum_chrome_version: '122',
    background: { service_worker: 'background.js', type: 'module' },
  },
  firefox: {
    ...common,
    background: { scripts: ['background.js'], type: 'module' },
    browser_specific_settings: {
      gecko: {
        id: 'nexor-vault@nexor.app',
        strict_min_version: '142.0',
        // Obligatorio en AMO: qué datos salen del navegador. Las credenciales (hash de autenticación)
        // viajan solo al servidor de Nexor del propio usuario; no hay analítica ni terceros.
        data_collection_permissions: { required: ['authenticationInfo'] },
      },
    },
  },
};

async function bundle(outdir) {
  const shared = {
    bundle: true,
    target: 'es2022',
    platform: 'browser',
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    alias: { '@': root },
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"', __DEFAULT_SERVER__: JSON.stringify(SERVER_ORIGIN) },
  };
  await build({ ...shared, entryPoints: [path.join(here, 'src/background.ts')], outfile: path.join(outdir, 'background.js'), format: 'esm' });
  await build({ ...shared, entryPoints: [path.join(here, 'src/popup/popup.ts')], outfile: path.join(outdir, 'popup.js'), format: 'iife' });
  await build({ ...shared, entryPoints: [path.join(here, 'src/fill.ts')], outfile: path.join(outdir, 'fill.js'), format: 'iife' });
  await build({ ...shared, entryPoints: [path.join(here, 'src/capture.ts')], outfile: path.join(outdir, 'capture.js'), format: 'iife' });
}

async function icons(outdir) {
  mkdirSync(path.join(outdir, 'icons'), { recursive: true });
  const source = path.join(root, 'public/icon-512.png');
  for (const size of [16, 32, 48, 128]) {
    await sharp(source).resize(size, size).png().toFile(path.join(outdir, 'icons', `icon-${size}.png`));
  }
}

function zipDir(dir, file) {
  const entries = {};
  (function walk(d, prefix) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, prefix + e.name + '/');
      else entries[prefix + e.name] = new Uint8Array(readFileSync(p));
    }
  })(dir, '');
  writeFileSync(file, zipSync(entries, { level: 9 }));
}

const dist = path.join(here, 'dist');
rmSync(dist, { recursive: true, force: true });

async function main() {
  for (const target of ['chrome', 'firefox']) {
    const out = path.join(dist, target);
    mkdirSync(out, { recursive: true });
    await bundle(out);
    cpSync(path.join(here, 'src/popup/popup.html'), path.join(out, 'popup.html'));
    cpSync(path.join(here, 'src/popup/popup.css'), path.join(out, 'popup.css'));
    await icons(out);
    writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifests[target], null, 2));
    console.log(`✔ extension/dist/${target}`);
    if (wantZip) {
      const file = path.join(dist, `nexor-vault-${target}-${pkg.version}.zip`);
      zipDir(out, file);
      console.log(`  → ${path.relative(root, file)}`);
      if (publish) {
        const pub = path.join(root, 'public', 'downloads');
        mkdirSync(pub, { recursive: true });
        cpSync(file, path.join(pub, `nexor-vault-${target}.zip`));
      }
    }
  }
}

if (publish) {
  // En producción la extensión es un extra: nunca debe impedir que la web se despliegue.
  main().catch((err) => console.warn('⚠ No se pudo generar la extensión (se omite):', err?.message ?? err));
} else {
  await main();
}
