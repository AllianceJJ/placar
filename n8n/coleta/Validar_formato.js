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
/* 03/11/2026: o resto do mes que o painel e o Relatorio usam. mes.mes fora de AAAA-MM faz o
   painel ignorar o mes inteiro; cadastrados/contratos ativos vao para "Historico da base". */
exige(typeof m.mes === 'string' && /^\d{4}-\d{2}$/.test(m.mes), 'mes.mes fora do formato AAAA-MM');
for (const k of ['retornos', 'valorInad', 'leads', 'matriculas']) exige(num(m[k]), 'mes.' + k + ' nao e numero');
for (const k of ['cadastrados_ativos', 'contratos_ativos']) exige(num(b[k]), 'base.' + k + ' nao e numero');

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
for (const k of ['complemento_erro', 'complemento_erro_2', 'mapa_grade_erro', 'vendas_erro', 'mrr_erro']) if (d[k]) aviso.push(k + ': ' + d[k]);
const diag = out.diagnostico || {};
/* 11/11/2026: a lista inteira de leads se perdeu em 2 chamadas com erro 500 (01/11) e a
   rodada passou como "ok", porque so se avisava acima de 5 erros. Erro numa lista que
   vira numero do placar avisa sempre; nas consultas por pessoa (agenda, historico),
   continua o limite de 5. */
const LISTAS = ['membros', 'contratos', 'cancel', 'churn', 'vendas', 'receb', 'atraso', 'prospects', 'entradas', 'freq'];
if (arr(diag.respostas_erro) && diag.respostas_erro.length) {
  const graves = diag.respostas_erro.filter(e => LISTAS.indexOf(String(e).split(':')[0]) >= 0);
  if (graves.length) aviso.push('ERRO NA EVO: ' + graves.join(', ') + ' (numeros dessas listas sairam incompletos)');
  if (diag.respostas_erro.length - graves.length > 5) aviso.push((diag.respostas_erro.length - graves.length) + ' consultas por pessoa na EVO com erro');
}
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
    /* por URL sem o skip: os leads vem em janelas de datas com o mesmo prefixo */
    const chave = r.url.replace(/([?&]skip=)\d+/, '$1');
    const c = cob[chave] || (cob[chave] = { pre: pre, ate: 0, total: 0 });
    c.ate = Math.max(c.ate, Number(mS[1]) + Number(mT[1]));
    const t = Number(r.cabecalho && r.cabecalho.total);
    if (isFinite(t) && t > c.total) c.total = t;
  }
  for (const c of Object.values(cob)) if (c.total > c.ate) aviso.push('TRUNCADO: ' + c.pre + ' leu ate a linha ' + c.ate + ' de ' + c.total);
} catch (e) { aviso.push('conferencia de paginas falhou: ' + String(e && e.message || e)); }
if (m.leads_evo !== undefined && !num(m.leads_evo)) aviso.push('mes.leads_evo nao e numero');
if (m.leads_convertidos !== undefined && !num(m.leads_convertidos)) aviso.push('mes.leads_convertidos nao e numero');

/* 08/10/2026: venda nova x renovacao. Aviso, nao erro: se faltar, so a secao Vendas do
   mes some no painel. A soma tem de bater com a lista venda a venda.
   03/11/2026: obrigatorios no painel desde 27/10 — continua aviso aqui de proposito. */
if (!num(m.vendas_novas) || !num(m.vendas_renovacao)) aviso.push('mes.vendas_novas / vendas_renovacao ausentes (obrigatorios no painel desde 27/10: a secao Vendas do mes cai)');
else if (!arr(d.vendas_do_mes)) aviso.push('detalhe.vendas_do_mes nao e lista');
else {
  if (d.vendas_do_mes.length !== m.vendas_novas + m.vendas_renovacao) aviso.push('vendas: ' + d.vendas_do_mes.length + ' na lista, ' + (m.vendas_novas + m.vendas_renovacao) + ' no total');
  const ruins = d.vendas_do_mes.filter(x => !(obj(x) && typeof x.aluno === 'string' && typeof x.plano === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(x.data || '')) && (x.tipo === 'nova' || x.tipo === 'renovacao'))).length;
  if (ruins) aviso.push('vendas_do_mes: ' + ruins + ' itens fora do formato {aluno, plano, data, tipo}');
}
/* 03/11/2026: o que faltava do contrato-dados.md. Tudo aviso: se faltar, so uma secao do
   painel mostra "dado indisponivel" — nao vale derrubar a rodada de segunda por isso.
   Os mesmos campos o "Validar dados" do Relatorio confere e manda no WhatsApp. */
const texto = (v) => typeof v === 'string' && v.length > 0;
const anoMes = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);
const avisa = (cond, msg) => { if (!cond) aviso.push(msg); };
const itens = (lista, campos, rotulo) => {
  if (!arr(lista)) return;
  const nomes = Object.keys(campos);
  const ruins = lista.filter(x => !(obj(x) && nomes.every(c => campos[c](x[c])))).length;
  if (ruins) aviso.push(rotulo + ': ' + ruins + ' de ' + lista.length + ' itens fora do formato {' + nomes.join(', ') + '}');
};
avisa(num(b.cadastro_sem_contrato_vigente), 'base.cadastro_sem_contrato_vigente nao e numero');
itens(m.professores, { nome: texto, realizadas: num, fechadas: num }, 'mes.professores');
if (m.professoresSemana !== undefined) { avisa(arr(m.professoresSemana), 'mes.professoresSemana nao e lista'); itens(m.professoresSemana, { nome: texto }, 'mes.professoresSemana'); }
itens(m.planos, { nome: texto, alunos: num, receita: num }, 'mes.planos');
avisa(obj(d.coorte_resumo), 'detalhe.coorte_resumo nao e objeto');
if (obj(d.churn)) {
  avisa(num(d.churn.total), 'detalhe.churn.total nao e numero');
  avisa(obj(d.churn.motivos), 'detalhe.churn.motivos nao e objeto');
  itens(d.churn.serie_mensal, { mes: anoMes, cancelamentos: num }, 'detalhe.churn.serie_mensal');
  if (d.churn.pior_mes !== undefined && d.churn.pior_mes !== null) avisa(obj(d.churn.pior_mes) && anoMes(d.churn.pior_mes.mes), 'detalhe.churn.pior_mes.mes fora do formato AAAA-MM');
}
if (obj(d.alunos_em_risco)) {
  avisa(num(d.alunos_em_risco.ativos_avaliados), 'detalhe.alunos_em_risco.ativos_avaliados nao e numero');
  itens(d.alunos_em_risco.lista, { nome: texto, dias_sem_treinar: (v) => v === undefined || v === null || num(v) }, 'detalhe.alunos_em_risco.lista');
}
if (obj(d.aptos_ao_exame)) itens(d.aptos_ao_exame.lista, { nome: texto, aulas: num }, 'detalhe.aptos_ao_exame.lista');
if (obj(d.pipeline)) itens(d.pipeline.lista, { nome: texto, dias: num }, 'detalhe.pipeline.lista');
itens(d.experimentais_do_mes, { data: texto }, 'detalhe.experimentais_do_mes');
itens(d.coortes_entrada, { mes: anoMes, entraram: num, sobreviveram: num }, 'detalhe.coortes_entrada');
itens(d.planos_vendidos, { nome: texto, novas: num, renovacoes: num }, 'detalhe.planos_vendidos');
itens(d.aulas_por_professor, { professor: texto, aulas: num, presencas: num }, 'detalhe.aulas_por_professor');
itens(d.aulas_por_modalidade, { modalidade: texto, aulas: num }, 'detalhe.aulas_por_modalidade');
itens(d.folha_do_mes, { professor: texto, aulas: num, coletivas: num, introdutorias: num, presencas: num }, 'detalhe.folha_do_mes');

if (num(diag.vendas_sem_historico) && diag.vendas_sem_historico > 0) aviso.push(diag.vendas_sem_historico + ' venda(s) classificada(s) sem o historico de contratos (regra reserva pelo cadastro)');

if (grave.length) {
  throw new Error('Placar — Coleta: formato quebrado, nada foi entregue ao Relatorio. ' + grave.join('; ') + '.');
}
out.validacao = { ok: true, conferidoEm: new Date().toISOString(), avisos: aviso };
return [{ json: out }];
