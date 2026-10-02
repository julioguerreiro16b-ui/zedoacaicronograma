const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'cronograma_loja.json'), 'utf8');
const template = fs.readFileSync(path.join(root, 'painel.template.html'), 'utf8');
const logo = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'referencia_logo_ifood.jpg')).toString('base64');
const panel = template.replace('__DATA__', source).replace('__LOGO__', logo);
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'index.html'), panel);
for (const file of ['index.html', 'schedule-core.js', 'sync-store.js', 'app.js', 'cronograma_para_imprimir.html', 'cronograma_para_imprimir.pdf']) {
  fs.copyFileSync(path.join(root, file), path.join(root, 'public', file));
}
console.log('Painel atualizado e arquivos de deploy preparados.');
