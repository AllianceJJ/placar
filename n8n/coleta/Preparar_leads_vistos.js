/* 06/10/2026: guarda cada lead desta coleta na Data Table "Leads vistos".
   A EVO tira o lead de /v1/prospects quando ele converte, e com ele vao a data de
   cadastro da oportunidade e o canal ("Como conheceu"). Guardando aqui, o
   Complementar da proxima coleta ainda sabe de onde veio quem virou aluno.
   Sempre devolve pelo menos uma linha: se este no ficasse vazio, a Coleta terminaria
   sem saida e o Relatorio nao receberia nada (a linha idProspect 0 e so marcador). */
let resp = $('Motor EVO').all().map(i => i.json);
try { resp = resp.concat($('Motor EVO (leads)').all().map(i => i.json)); } catch (e) { /* so fase 1 */ }
const hoje = new Date(Date.now() - 10800000).toISOString().slice(0, 10);
const k10 = v => { const d = String(v || '').replace(/[^0-9]/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
const visto = {}, linhas = [];
for (const r of resp) {
  if (!r || String(r.rotulo || '').indexOf('prospects:') !== 0 || !Array.isArray(r.itens)) continue;
  for (const p of r.itens) {
    if (!p || !p.idProspect || visto[p.idProspect]) continue;
    visto[p.idProspect] = 1;
    const e = String(p.email || '').trim().toLowerCase();
    linhas.push({ json: {
      idProspect: Number(p.idProspect),
      cadastro: String(p.registerDate || '').slice(0, 10),
      canal: String(p.mktChannel || '').trim(),
      nome: [p.firstName, p.lastName].filter(Boolean).join(' ').trim().toUpperCase(),
      fone: k10(p.cellphone),
      email: e.indexOf('@') > 0 ? e : '',
      etapa: String(p.currentStep || '').trim(),
      vistoEm: hoje
    } });
  }
}
if (!linhas.length) linhas.push({ json: { idProspect: 0, cadastro: '', canal: '', nome: '(nenhum lead nesta coleta)', fone: '', email: '', etapa: '', vistoEm: hoje } });
return linhas;
