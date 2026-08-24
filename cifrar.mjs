// Referência de criptografia — o mesmo código roda num nó Code do n8n.
// Uso: node cifrar.mjs <senha> <entrada.json> <saida.json>
import fs from 'fs';
const [,, senha, entrada, saida] = process.argv;
const enc = new TextEncoder();
const b64e = b => Buffer.from(new Uint8Array(b)).toString('base64');

const dados = JSON.parse(fs.readFileSync(entrada,'utf8'));
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv   = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
const chave = await crypto.subtle.deriveKey(
  {name:'PBKDF2', salt, iterations:200000, hash:'SHA-256'},
  base, {name:'AES-GCM', length:256}, false, ['encrypt']);
const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, chave, enc.encode(JSON.stringify(dados)));

fs.writeFileSync(saida, JSON.stringify({
  cifrado: 1,
  atualizadoEm: dados.atualizadoEm || null,   // fica em claro: só o carimbo de horário
  salt: b64e(salt), iv: b64e(iv), dados: b64e(ct)
}, null, 2));
console.log('cifrado:', saida, fs.statSync(saida).size, 'bytes');
