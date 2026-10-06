/* 24/09/2026: contrato de dados da Coleta.
   Em 21/09 o Relatorio quebrou porque a Coleta mudou alunos_em_risco de lista para
   objeto e ninguem avisou os consumidores. Este no confere a forma do que sai daqui
   antes de entregar. Consumidores: 'Placar — Relatorio' (Montar mensagens, Montar e
   criptografar) e o index.html do painel.
   REGRA: se voce mudar a forma de um campo abaixo de proposito, mude aqui tambem — e
   confira os dois consumidores antes de publicar.
   Erro grave (forma errada, base zerada) PARA a execucao com mensagem clara: o
   workflow de erro avisa no mesmo dia e o painel mantem a foto anterior, com o
   alerta de dados velhos. Aviso leve so e anotado em validacao.avisos. */
const out = $input.first().json || {};
const grave = [], aviso = [];
const num = (v) => typeof v === 'number' && isFinite(v);
const arr = Array.isArray;
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const exige = (cond, msg) => { if (!cond) grave.push(msg); };

exige(out.ok === true, 'ok ausente');
exige(obj(out.mes), 'mes nao e objeto');
exige(obj(out.semana), 'semana nao e objeto');
exige(obj(out.base), 'base nao e objeto');
exige(obj(out.detalhe), 'detalhe nao e objeto');
const m = out.mes || {}, b = out.base || {}, d = out.detalhe || {};
for (const k of ['alunos', 'contratos', 'novos', 'cancelamentos', 'mrr', 'inadimplentes', 'agendadas', 'realizadas'])
  exige(num(m[k]), 'mes.' + k + ' nao e numero');
for (const k of ['professores', 'planos', 'servicos', 'produtos']) exige(arr(m[k]), 'mes.' + k + ' nao e lista');
exige(num(b.alunos_ativos), 'base.alunos_ativos nao e numero');
if (num(m.alunos)) exige(m.alunos > 0, 'mes.alunos veio 0 — a EVO provavelmente falhou');

for (const k of ['aulas_por_professor', 'aulas_por_modalidade', 'folha_do_mes', 'experimentais_do_mes', 'planos_vendidos', 'matriculas_sem_experimental', 'coortes_entrada', 'alunos_em_risco'])
  if (k !== 'alunos_em_risco') exige(arr(d[k]), 'detalhe.' + k + ' nao e lista');
exige(obj(d.churn) && arr(d.churn.serie_mensal), 'detalhe.churn.serie_mensal nao e lista');
exige(obj(d.folha_resumo), 'detalhe.folha_resumo nao e objeto');
/* os quatro que viraram objeto em 17/09 — o formato que os consumidores esperam hoje */
exige(obj(d.alunos_em_risco) && num(d.alunos_em_risco.total) && arr(d.alunos_em_risco.lista), 'detalhe.alunos_em_risco fora do formato {total, lista}');
exige(obj(d.aptos_ao_exame) && num(d.aptos_ao_exame.total) && arr(d.aptos_ao_exame.lista), 'detalhe.aptos_ao_exame fora do formato {total, lista}');
exige(obj(d.infantil) && num(d.infantil.ativos) && arr(d.infantil.lista), 'detalhe.infantil fora do formato {ativos, lista}');
exige(obj(d.pipeline) && num(d.pipeline.abertos) && arr(d.pipeline.lista), 'detalhe.pipeline fora do formato {abertos, lista}');

/* 25/09/2026: mapa_grade ganhou 8 semanas, kids/baby marcados e turmas com professor.
   Formato fora do esperado so vira aviso: o mapa e um bloco do painel, nao para o relatorio. */
const mg = d.mapa_grade;
if (!(obj(mg) && arr(mg.celulas))) aviso.push('mapa_grade ausente');
else {
  if (!mg.celulas.length) aviso.push('mapa_grade veio vazio');
  const ruins = mg.celulas.filter(c => !(obj(c) && num(c.dia) && typeof c.hora === 'string'
    && typeof c.infantil === 'boolean' && arr(c.turmas))).length;
  if (ruins) aviso.push('mapa_grade: ' + ruins + ' horarios fora do formato {dia, hora, infantil, turmas}');
  if (num(mg.dias_lidos) && mg.dias_lidos < 40) aviso.push('mapa_grade leu so ' + mg.dias_lidos + ' dias com aula nas 8 semanas');
}
for (const k of ['complemento_erro', 'complemento_erro_2', 'mapa_grade_erro']) if (d[k]) aviso.push(k + ': ' + d[k]);
const diag = out.diagnostico || {};
if (arr(diag.respostas_erro) && diag.respostas_erro.length > 5) aviso.push(diag.respostas_erro.length + ' chamadas da EVO com erro');
if (d.funil_diagnostico && d.funil_diagnostico.fila_truncada) aviso.push('funil truncado: ' + d.funil_diagnostico.pessoas_que_ficaram_de_fora + ' pessoas fora da agenda');

/* 06/10/2026: lista paginada cortada vira numero errado em silencio (foi o caso da
   inadimplencia: 300 de 1.671 recebiveis). A Agenda dos leads completa as paginas
   pelo header 'total'; se ainda assim faltar, o aviso comeca com TRUNCADO e o
   Relatorio manda para o WhatsApp. */
try {
  let resp = $('Motor EVO').all().map(i => i.json);
  try { resp = resp.concat($('Motor EVO (leads)').all().map(i => i.json)); } catch (e) { /* so fase 1 */ }
  const cob = {};
  for (const r of resp) {
    if (!r || !r.rotulo || !r.url) continue;
    const pre = String(r.rotulo).split(':')[0];
    const mT = /[?&]take=(\d+)/.exec(r.url), mS = /[?&]skip=(\d+)/.exec(r.url);
    if (!mT || !mS) continue;
    const c = cob[pre] || (cob[pre] = { ate: 0, total: 0 });
    c.ate = Math.max(c.ate, Number(mS[1]) + Number(mT[1]));
    const t = Number(r.cabecalho && r.cabecalho.total);
    if (isFinite(t) && t > c.total) c.total = t;
  }
  for (const pre of Object.keys(cob)) if (cob[pre].total > cob[pre].ate) aviso.push('TRUNCADO: ' + pre + ' leu ate a linha ' + cob[pre].ate + ' de ' + cob[pre].total);
} catch (e) { aviso.push('conferencia de paginas falhou: ' + String(e && e.message || e)); }
if (m.leads_evo !== undefined && !num(m.leads_evo)) aviso.push('mes.leads_evo nao e numero');
if (m.leads_convertidos !== undefined && !num(m.leads_convertidos)) aviso.push('mes.leads_convertidos nao e numero');

if (grave.length) {
  throw new Error('Placar — Coleta: formato quebrado, nada foi entregue ao Relatorio. ' + grave.join('; ') + '.');
}
out.validacao = { ok: true, conferidoEm: new Date().toISOString(), avisos: aviso };
return [{ json: out }];
