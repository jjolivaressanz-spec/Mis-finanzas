import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

async function main() {
  const rootDir = process.cwd();
  const zip = new AdmZip();

  // Asegurar que existe la carpeta public para que Vite sirva el archivo
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, 'proyecto-finanzas.zip');

  // Lista de archivos y directorios permitidos (excluyendo node_modules, dist, etc.)
  const itemsToInclude = [
    'components',
    'services',
    'scripts',
    'App.tsx',
    'index.html',
    'index.tsx',
    'metadata.json',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'types.ts',
    'vite.config.ts',
    '.gitignore'
  ];

  for (const item of itemsToInclude) {
    const fullPath = path.join(rootDir, item);
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      zip.addLocalFolder(fullPath, item);
    } else {
      zip.addLocalFile(fullPath);
    }
  }

  zip.writeZip(outputPath);
  console.log(`ZIP creado con éxito en: ${outputPath}`);
}

main().catch(err => {
  console.error("Error al crear el archivo ZIP:", err);
  process.exit(1);
});
