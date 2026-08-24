# Placar da Alliance SJC

Painel gerencial da Alliance Jiu-Jitsu São José dos Campos.

## Como funciona

- `index.html` — o painel inteiro num arquivo só. Não tem build, não tem dependência externa.
- `dados.json` — os números. **Escrito automaticamente pelo n8n**, não edite à mão.

O painel lê o `dados.json` toda vez que abre. Quem atualiza é a automação:

| Quando | O que roda |
|---|---|
| Todo dia, 03h | Coleta o movimento do dia na EVO API |
| Segunda, 06h | Fecha a semana, grava o `dados.json` e dispara WhatsApp + e-mail |
| Dia 1º, 06h | Fecha o mês e recalcula coortes, planos e cenários |

## Criptografia

O `dados.json` fica **público** — o GitHub Pages não tem site privado fora do plano
Enterprise. Por isso a automação grava o arquivo criptografado: quem abrir a URL sem
a senha vê só um bloco de base64 inútil.

- **AES-256-GCM**, chave derivada por **PBKDF2-SHA256 com 200.000 iterações**
- `salt` e `iv` novos a cada gravação, guardados no próprio arquivo
- O único campo em claro é `atualizadoEm`, para o carimbo do cabeçalho

O painel pede a senha na primeira visita de cada aparelho e guarda no navegador.
Clicando no carimbo "Atualizado ..." ele esquece a senha e pergunta de novo — use
isso se digitar errado ou se emprestar o computador.

O arquivo que vai neste repositório na primeira publicação está **em claro e vazio**:
não tem nada para proteger ainda. A partir da primeira execução do n8n ele passa a
vir criptografado, e o painel entende os dois formatos.

### Criptografar (o que o nó Code do n8n faz)

```js
const senha = 'a senha do painel';          // vem de uma variável de ambiente do n8n
const enc = new TextEncoder();
const b64 = b => Buffer.from(new Uint8Array(b)).toString('base64');

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv   = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
const chave = await crypto.subtle.deriveKey(
  { name:'PBKDF2', salt, iterations:200000, hash:'SHA-256' },
  base, { name:'AES-GCM', length:256 }, false, ['encrypt']);
const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, chave, enc.encode(JSON.stringify(dados)));

return [{ json: {
  cifrado: 1,
  atualizadoEm: dados.atualizadoEm,
  salt: b64(salt), iv: b64(iv), dados: b64(ct)
}}];
```

`cifrar.mjs`, na raiz do projeto, é a mesma implementação rodando pelo terminal —
serve para testar ou para gerar o arquivo na mão se precisar.

## Lançamento manual

O botão "Lançar mês" continua funcionando como plano B, mas o que você digitar
fica **só no seu navegador** — não vai para o `dados.json` nem para os outros sócios.
Use o backup em JSON se precisar levar esses dados para outro lugar.

## Estrutura do dados.json

```jsonc
{
  "versao": 1,
  "atualizadoEm": "2026-08-24T06:00:00-03:00",  // carimbo mostrado no cabeçalho
  "teto": 350,             // teto da estrutura (estacionamento, banheiros, armários)
  "horizonte": 12,         // meses de projeção
  "metas": { },            // faixas do semáforo
  "cenarios": null,        // premissas sobrescritas (null = calculado do histórico)
  "meses": [
    {
      "mes": "2026-08",
      "alunosInicio": 258, "alunos": 264, "contratos": 271,
      "novos": 18, "retornos": 4, "cancelamentos": 16,
      "inadimplentes": 12, "valorInad": 3200, "mrr": 86500,
      "leads": 110, "agendadas": 48, "realizadas": 35, "matriculas": 22,
      "invMkt": 2800,
      "professores": [ { "nome": "", "realizadas": 0, "fechadas": 0 } ],
      "planos":      [ { "nome": "", "alunos": 0, "vendas": 0, "receita": 0 } ]
    }
  ]
}
```

## Regenerar o index.html

O painel é mantido no artifact do Claude e exportado com `build-github.py`,
que embrulha o arquivo num documento HTML completo e liga o carimbo de
"atualizado em". Não edite o `index.html` na mão — as mudanças se perdem na
próxima exportação.
