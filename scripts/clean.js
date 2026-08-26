// Clean script — removes duplicate files and empty dirs
const fs = require('fs');
const path = require('path');

console.log('Cleaning SUPREME repo...\n');

// Files to delete (duplicates, non-code in root)
const filesToDelete = [
  'console.log',
  'constructor()',
  'LICENSE',
  'README.md',
  'READ.MD',
  'system.json',
  'config.yaml',
  'secrets.yaml',
  'ingress.yaml',
  'services.yaml',
  'namespaces.yaml',
  'grafana.yaml',
  'ai-gateway.yaml',
  'turbo.json'
];

let deleted = 0;

for (const file of filesToDelete) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('Deleted: ' + file);
    deleted++;
  }
}

console.log('\nTotal deleted: ' + deleted);
