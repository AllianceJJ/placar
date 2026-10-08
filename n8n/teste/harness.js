/* Executor local dos nós Code da Coleta, imitando o n8n:
   $input.all()/first(), $('Nó').all()/first(), Date travado na hora da execução real. */
window.H = (() => {
  const carregar = async (arq) => { const r = await fetch(arq + '?t=' + Date.now()); if (!r.ok) throw new Error(arq + ' ' + r.status); return r.json(); };
  const texto = async (arq) => { const r = await fetch(arq + '?t=' + Date.now()); if (!r.ok) throw new Error(arq + ' ' + r.status); return r.text(); };
  const salvar = async (arq, obj) => { await fetch(arq, { method: 'PUT', body: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1) }); };
  const embrulha = (arr) => arr.map(j => ({ json: j }));
  const fazData = (agoraMs) => {
    const R = Date;
    function D(...a) { if (!(this instanceof D)) return new R(agoraMs).toString(); return a.length ? new R(...a) : new R(agoraMs); }
    D.prototype = R.prototype; D.now = () => agoraMs; D.UTC = R.UTC; D.parse = R.parse;
    return D;
  };
  /* roda um nó: codigo (string), saidas = {nome: [json...]}, entrada = [json...] */
  const rodar = (codigo, saidas, entrada, agoraMs) => {
    const $input = { all: () => embrulha(entrada), first: () => embrulha(entrada)[0] };
    const $ = (nome) => { if (!(nome in saidas)) throw new Error('Nó sem saída no teste: ' + nome); const a = embrulha(saidas[nome]); return { all: () => a, first: () => a[0], isExecuted: !!a.length }; };
    const f = new Function('$input', '$', 'Date', 'return (function(){' + codigo + '\n})();');
    const r = f($input, $, fazData(agoraMs));
    return r.map(i => i.json);
  };
  return { carregar, texto, salvar, rodar };
})();
