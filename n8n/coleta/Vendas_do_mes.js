/* 08/10/2026: VENDA NOVA x RENOVACAO (decisoes do Eduard em 27/09/2026).
   No proprio, entre o Complementar e o Mapa da grade, para nao mexer no Calcular.
   Venda = contrato de plano vendido no mes. Fora: a cobranca automatica do recorrente
   (idSaleRecurrency) e o VIP/cortesia de R$ 0.
   Nova = primeiro contrato do aluno na escola. Renovacao = ja teve contrato antes, vigente
   ou vencido. O historico vem de /v1/members/{id} (campo memberships), pedido na Agenda dos
   leads com rotulo 'hist:<idMember>'. Observacao da renovacao:
   - 'contrato adicional': um contrato anterior, de outro plano, segue ativo depois do inicio
     do novo (ex.: particular);
   - 'mesmo plano' / 'troca de plano': o anterior terminou ha ate 30 dias;
   - 'retorno': estava sem contrato havia mais de 30 dias.
   Contrato cancelado no proprio dia de inicio (venda desfeita) nao conta como historico.
   Sem historico (chamada falhou ou passou do teto) cai na regra reserva: cadastro criado no
   mes = nova, senao renovacao; quantas foram assim fica em diagnostico.
   Testado em 08/10/2026 com as vendas reais de setembro: 32 vendas, 18 novas e 14 renovacoes. */
const out = $input.first().json || {};
try {
  let respostas = [];
  try { respostas = $('Motor EVO').all().map(i => i.json); } catch (e) { respostas = []; }
  try { respostas = respostas.concat($('Motor EVO (leads)').all().map(i => i.json)); } catch (e) { /* so fase 1 */ }
  const ctx = $('Plano de coleta').first().json || {};
  const iMes = String(ctx.inicioMes || ''), fMes = String(ctx.fimMes || '');
  const dia = (v) => (v ? String(v).slice(0, 10) : null);
  const noPeriodo = (v, de, ate) => { const d = dia(v); return !!d && d >= de && d <= ate; };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const juntar = (p) => { const o = []; for (const r of respostas) { if (r && r.rotulo && String(r.rotulo).indexOf(p + ':') === 0 && Array.isArray(r.itens)) o.push(...r.itens); } return o; };
  const ehVip = (n) => String(n || '').toUpperCase().indexOf('VIP') >= 0;

  const todosPorId = {};
  for (const m of juntar('membros')) { const id = m && m.idMember; if (id && !todosPorId[id]) todosPorId[id] = m; }
  const nomeDe = (id) => { const m = todosPorId[id]; const n = m ? ((m.firstName || '') + ' ' + (m.lastName || '')).trim() : ''; return n || ('id ' + id); };

  const histPorId = {};
  for (const r of respostas) {
    if (!r || !r.rotulo || String(r.rotulo).indexOf('hist:') !== 0 || r.ok !== true) continue;
    const d0 = Array.isArray(r.itens) ? r.itens[0] : null;
    if (d0 && Array.isArray(d0.memberships)) histPorId[String(r.rotulo).slice(5)] = d0.memberships;
  }
  /* O mesmo plano vem com nomes diferentes: na venda 'PLANO MENSAL (Sessoes Ilimitadas)', no
     historico 'PLANO MENSAL'; e a versao do ano troca ('RECORRENTE 2025' -> 'RECORRENTE 2026').
     Mesmo plano = mesmo codigo (idMembership) OU mesmo nome sem parentese e sem ano. */
  const nomePlanoChave = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\b20\d\d\b/g, ' ').replace(/[^A-Za-z0-9À-ÿ]+/g, ' ').trim().toUpperCase();
  const mesmoPlano = (h, it) => (!!h.idMembership && !!it.idMembership && String(h.idMembership) === String(it.idMembership))
    || nomePlanoChave(h.name) === nomePlanoChave(it.item || it.description);
  const fimEfetivo = (h) => { const f = dia(h.endDate), c = dia(h.cancelDate); return (c && (!f || c < f)) ? c : f; };
  const diasEntre = (a, b) => (a && b) ? Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000) : null;

  const vendas = [], vistaVenda = {};
  for (const v of juntar('vendas')) { const k = v && v.idSale; if (k && vistaVenda[k]) continue; if (k) vistaVenda[k] = 1; vendas.push(v); }
  const lista = [];
  let semHistorico = 0;
  for (const v of vendas) {
    if (!v || v.idSaleRecurrency || !v.idMember || !noPeriodo(v.saleDate, iMes, fMes)) continue;
    const dv = dia(v.saleDate);
    for (const it of (Array.isArray(v.saleItens) ? v.saleItens : [])) {
      if (!it || !it.idMembership) continue;
      const plano = String(it.item || it.description || 'Sem nome').trim();
      if ((num(it.saleValue) || num(it.itemValue)) <= 0 || ehVip(plano)) continue;
      const hist = histPorId[String(v.idMember)];
      let tipo = 'nova', observacao = '', anterior = '';
      if (!hist) {
        semHistorico += 1;
        const m0 = todosPorId[v.idMember];
        if (!(m0 && noPeriodo(m0.registerDate, iMes, fMes))) tipo = 'renovacao';
      } else {
        const desta = hist.filter(h => h && v.idSale && String(h.idSale || '') === String(v.idSale));
        const iniNovo = desta.length ? (desta.map(h => dia(h.startDate)).filter(Boolean).sort()[0] || dv) : dv;
        const antes = hist.filter(h => {
          if (!h || (v.idSale && String(h.idSale || '') === String(v.idSale))) return false;
          const ini = dia(h.startDate); if (!ini) return false;
          const c = dia(h.cancelDate); if (c && c <= ini) return false;
          return String(h.saleDate || h.startDate || '') < String(v.saleDate || '') || ini < iniNovo;
        });
        if (antes.length) {
          tipo = 'renovacao';
          const ult = antes.slice().sort((a, b) => String(fimEfetivo(b) || '').localeCompare(String(fimEfetivo(a) || '')))[0];
          anterior = String(ult.name || '').trim();
          const segueAtivo = antes.some(h => !h.cancelDate && fimEfetivo(h) && fimEfetivo(h) > iniNovo && !mesmoPlano(h, it));
          const gap = diasEntre(fimEfetivo(ult), iniNovo);
          if (segueAtivo) observacao = 'contrato adicional';
          else if (gap !== null && gap > 30) observacao = 'retorno';
          else observacao = mesmoPlano(ult, it) ? 'mesmo plano' : 'troca de plano';
        }
      }
      const item = { aluno: nomeDe(v.idMember), plano, data: dv, tipo };
      if (observacao) item.observacao = observacao;
      if (anterior) item.plano_anterior = anterior;
      lista.push(item);
    }
  }
  lista.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const novas = lista.filter(x => x.tipo === 'nova').length;
  out.mes = out.mes || {};
  out.mes.vendas_novas = novas;
  out.mes.vendas_renovacao = lista.length - novas;
  out.detalhe = out.detalhe || {};
  out.detalhe.vendas_do_mes = lista;
  out.diagnostico = out.diagnostico || {};
  out.diagnostico.historicos_de_contrato_lidos = Object.keys(histPorId).length;
  out.diagnostico.vendas_sem_historico = semHistorico;
} catch (e) {
  /* Erro aqui nao pode derrubar o Placar: a secao Vendas do mes so nao aparece. */
  out.detalhe = out.detalhe || {};
  out.detalhe.vendas_erro = String(e && e.message || e);
}
return [{ json: out }];
