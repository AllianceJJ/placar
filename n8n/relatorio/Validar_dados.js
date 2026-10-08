/* VALIDACAO DO dados.json (criado em 27/09/2026)
   Confere o que a Coleta devolveu contra o contrato que o painel usa (CONTRATO e
   CONTRATO_MES no index.html / contrato-dados.md, lista passada pelo Claude Code em
   27/09). NAO bloqueia a gravacao: o painel ja mostra "dado indisponivel" na secao
   afetada. Serve para o Eduard saber na hora que uma secao vai cair e por que.
   Se mudar o contrato do painel, atualize a lista REGRAS aqui junto.
   06/10/2026: tambem avisa quando uma lista da EVO veio cortada (aviso TRUNCADO da
   Coleta) — e numero errado sem nenhuma secao cair, o pior tipo de erro.
   08/10/2026: confere tambem venda nova x renovacao (opcional ate a 1a rodada real). */
const calc = $('Coleta').first().json || {};
const raiz = { mes: calc.mes, base: calc.base, detalhe: calc.detalhe };
const NL = String.fromCharCode(10);
const get = (o, p) => p.split('.').reduce((a, k) => (a === null || a === undefined) ? undefined : a[k], o);
const tipos = {
  num: (v) => typeof v === 'number' && isFinite(v),
  str: (v) => typeof v === 'string' && v.length > 0,
  ym: (v) => typeof v === 'string' && v.length === 7 && v.charAt(4) === '-' && !isNaN(Number(v.slice(0, 4))) && !isNaN(Number(v.slice(5))),
  list: (v) => Array.isArray(v),
  obj: (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
};
const nomeTipo = { num: 'numero', str: 'texto', ym: 'mes AAAA-MM', list: 'lista', obj: 'objeto' };
const problemas = [];
const checar = (caminho, tipo, secao, opcional) => {
  const v = get(raiz, caminho);
  if (v === undefined || v === null) { if (!opcional) problemas.push(caminho + ' faltando (' + secao + ')'); return false; }
  if (!tipos[tipo](v)) { problemas.push(caminho + ' deveria ser ' + nomeTipo[tipo] + ' (' + secao + ')'); return false; }
  return true;
};
const checarLista = (caminho, campos, secao, opcional) => {
  if (!checar(caminho, 'list', secao, opcional)) return;
  const arr = get(raiz, caminho) || [];
  let ruins = 0, exemplo = '';
  arr.forEach((it, i) => {
    for (const c in campos) {
      const ok = it && tipos[campos[c]](it[c]);
      if (!ok) { ruins += 1; if (!exemplo) exemplo = caminho + '[' + i + '].' + c + ' deveria ser ' + nomeTipo[campos[c]]; }
    }
  });
  if (ruins) problemas.push(exemplo + (ruins > 1 ? ' (+' + (ruins - 1) + ' ocorrencias)' : '') + ' (' + secao + ')');
};

/* Mes mais recente */
checar('mes.mes', 'ym', 'todas as secoes do mes');
['alunos', 'novos', 'retornos', 'cancelamentos'].forEach(c => checar('mes.' + c, 'num', 'Placar e Movimento'));
['mrr', 'contratos', 'inadimplentes', 'valorInad'].forEach(c => checar('mes.' + c, 'num', 'Placar e Receita'));
['leads', 'agendadas', 'realizadas', 'matriculas'].forEach(c => checar('mes.' + c, 'num', 'Funil'));
checarLista('mes.professores', { nome: 'str', realizadas: 'num', fechadas: 'num' }, 'Conversao por professor');
checarLista('mes.planos', { nome: 'str', alunos: 'num', receita: 'num' }, 'Mix de planos');
checar('mes.vendas_novas', 'num', 'Vendas do mes', true);
checar('mes.vendas_renovacao', 'num', 'Vendas do mes', true);

/* Composicao da base */
if (checar('base', 'obj', 'Composicao da base')) {
  ['cadastrados_ativos', 'alunos_ativos', 'contratos_ativos', 'cadastro_sem_contrato_vigente'].forEach(c => checar('base.' + c, 'num', 'Composicao da base'));
}

/* Detalhe: se faltar, caem Funil, Coortes, Cancelamento, Risco, Exame, Pipeline, Grade, Infantil, Folha e Fichas */
if (checar('detalhe', 'obj', 'metade do painel')) {
  checarLista('detalhe.experimentais_do_mes', { data: 'str' }, 'Funil');
  const exps = get(raiz, 'detalhe.experimentais_do_mes');
  if (Array.isArray(exps)) {
    const semId = exps.filter(e => e && !e.idMember && !e.idProspect).length;
    if (semId) problemas.push(semId + ' experimental(is) sem idMember nem idProspect: o funil junta pessoas diferentes numa so (Funil)');
  }
  checar('detalhe.matriculas_sem_experimental', 'list', 'Funil');
  checarLista('detalhe.leads_duplicados', { leads: 'list' }, 'Funil', true);
  checarLista('detalhe.coortes_entrada', { mes: 'ym', entraram: 'num', sobreviveram: 'num' }, 'Quem entra, fica?');
  checar('detalhe.coorte_resumo', 'obj', 'Quem entra, fica?');
  if (checar('detalhe.churn', 'obj', 'Cancelamento')) {
    checar('detalhe.churn.total', 'num', 'Cancelamento');
    checarLista('detalhe.churn.serie_mensal', { mes: 'ym', cancelamentos: 'num' }, 'Cancelamento');
    checar('detalhe.churn.motivos', 'obj', 'Cancelamento');
    if (get(raiz, 'detalhe.churn.pior_mes') !== undefined && get(raiz, 'detalhe.churn.pior_mes') !== null) checar('detalhe.churn.pior_mes.mes', 'ym', 'Cancelamento');
  }
  if (checar('detalhe.alunos_em_risco', 'obj', 'Alunos em risco')) {
    checar('detalhe.alunos_em_risco.total', 'num', 'Alunos em risco');
    checar('detalhe.alunos_em_risco.ativos_avaliados', 'num', 'Alunos em risco');
    checarLista('detalhe.alunos_em_risco.lista', { nome: 'str' }, 'Alunos em risco');
  }
  if (checar('detalhe.aptos_ao_exame', 'obj', 'Exame de faixa')) {
    checar('detalhe.aptos_ao_exame.total', 'num', 'Exame de faixa');
    checarLista('detalhe.aptos_ao_exame.lista', { nome: 'str', aulas: 'num' }, 'Exame de faixa');
  }
  if (checar('detalhe.pipeline', 'obj', 'Pipeline')) {
    checar('detalhe.pipeline.abertos', 'num', 'Pipeline');
    checarLista('detalhe.pipeline.lista', { nome: 'str', dias: 'num' }, 'Pipeline');
  }
  checarLista('detalhe.planos_vendidos', { nome: 'str', novas: 'num', renovacoes: 'num' }, 'Mix de planos');
  checarLista('detalhe.vendas_do_mes', { aluno: 'str', plano: 'str', data: 'str', tipo: 'str' }, 'Vendas do mes', true);
  const vnd = get(raiz, 'detalhe.vendas_do_mes'), vn = get(raiz, 'mes.vendas_novas'), vr = get(raiz, 'mes.vendas_renovacao');
  if (Array.isArray(vnd) && tipos.num(vn) && tipos.num(vr) && vnd.length !== vn + vr) problemas.push('vendas_do_mes tem ' + vnd.length + ' itens, mas novas + renovacoes = ' + (vn + vr) + ' (Vendas do mes)');
  checarLista('detalhe.aulas_por_professor', { professor: 'str', aulas: 'num', presencas: 'num' }, 'Grade da semana');
  checarLista('detalhe.aulas_por_modalidade', { modalidade: 'str', aulas: 'num' }, 'Grade da semana');
  if (get(raiz, 'detalhe.mapa_grade') !== undefined && get(raiz, 'detalhe.mapa_grade') !== null) {
    checarLista('detalhe.mapa_grade.celulas', { dia: 'num', hora: 'str' }, 'Mapa da grade');
  }
  if (checar('detalhe.infantil', 'obj', 'Turma infantil')) checar('detalhe.infantil.ativos', 'num', 'Turma infantil');
  checarLista('detalhe.folha_do_mes', { professor: 'str', aulas: 'num', coletivas: 'num', introdutorias: 'num', presencas: 'num' }, 'Folha e Fichas');
  checar('detalhe.folha_resumo', 'obj', 'Fichas');
}

/* Lista da EVO cortada: o numero sai menor sem nenhuma secao cair. */
const avisosColeta = (calc.validacao && Array.isArray(calc.validacao.avisos)) ? calc.validacao.avisos : [];
const truncados = avisosColeta.filter(a => String(a).indexOf('TRUNCADO') === 0);

if (!problemas.length && !truncados.length) return [];
const cfg = $('Configuração').first().json;
const L = ['⚠️ *Placar: dados com problema nesta coleta*', ''];
if (problemas.length) {
  L.push('O painel foi atualizado, mas estas seções devem aparecer como "dado indisponível":', '');
  problemas.slice(0, 12).forEach(p => L.push('• ' + p));
  if (problemas.length > 12) L.push('• e mais ' + (problemas.length - 12) + ' problema(s)');
  L.push('');
}
if (truncados.length) {
  L.push('Lista da EVO veio cortada — o número dessas seções sai menor do que é:', '');
  truncados.slice(0, 6).forEach(p => L.push('• ' + p));
  L.push('');
}
L.push('Mande esta mensagem para o Claude investigar a Coleta.');
return [{ json: { telefone: cfg.whatsapp, mensagem: L.join(NL), total: problemas.length + truncados.length } }];
