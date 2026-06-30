import { execSync } from 'child_process';
const out = execSync('python3 scripts/importar-fluxo-caixa.py', {
  cwd: '/Users/thiemyrocha/alt-orcamentos',
  encoding: 'utf-8'
});
console.log(out);
