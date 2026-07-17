import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = join(root, 'client', 'src');
const allowedDirectPrimeRoots = [
  'client/src/ui/prime/',
  'client/src/components/ui/',
  'client/src/test/',
  'client/src/main.tsx',
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (['.ts', '.tsx', '.css'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = await walk(sourceRoot);
const errors = [];

for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const source = await readFile(file, 'utf8');

  if (source.includes('.Mui')) {
    errors.push(`${rel}: legacy .Mui selector`);
  }

  if (/from ['"][^'"]*ui\/widgets['"]/.test(source)) {
    errors.push(`${rel}: import from the deleted ui/widgets compatibility layer`);
  }

  if (
    source.includes("from 'primereact/") ||
    source.includes('from "primereact/')
  ) {
    const allowed = allowedDirectPrimeRoots.some((entry) =>
      entry.endsWith('/') ? rel.startsWith(entry) : rel === entry,
    );
    if (!allowed) errors.push(`${rel}: direct PrimeReact import outside the UI integration layer`);
  }
}

if (errors.length > 0) {
  console.error('UI architecture guard found legacy or unapproved references:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('UI architecture guard passed.');
}
