# Teste offline dos nós Code do n8n

Serve para testar mudanças no código dos nós **sem chamar a EVO**: cada teste real da
Coleta custa ~290 chamadas (~R$ 4 à noite, ~R$ 8 de dia). Aqui o código roda no navegador
com a saída real de uma execução passada e com a data travada na hora daquela execução.

**Nunca grave dados de aluno nesta pasta.** O repositório é público. Os arquivos de
execução ficam só na pasta de rascunho local (o `.gitignore` bloqueia `dados/`).

## Como usar

1. Baixe a execução que serve de base com o MCP do n8n (`get_workflow_execution` com
   `includeData`) e salve as saídas dos nós como JSON em `n8n/teste/dados/`.
2. Suba o servidor local: `powershell -File n8n/teste/servir.ps1 -Raiz <pasta>` e abra
   `http://localhost:8765/<caminho>/harness.html`.
3. No console da página, `H.rodar(codigo, saidas, entrada, agoraMs)` executa um nó:
   - `codigo`: o texto do nó Code;
   - `saidas`: `{ 'Nome do nó': [json, ...] }` para cada `$('Nó')` que o código lê;
   - `entrada`: os itens de `$input`;
   - `agoraMs`: a hora da execução original (`Date.parse(startedAt)`).
4. Primeiro rode o código **atual** e confirme que ele reproduz a saída real sem nenhuma
   diferença. Só depois rode o código novo e compare. `setup.js` faz isso para a Coleta
   inteira (`preparar()` roda a versão antiga e a nova lado a lado).

Usado em 06–07/10/2026 na Coleta do Placar e na régua da Experimental.
