/* A coleta tem duas fases: a geral (Motor EVO) e a agenda de cada lead (Motor EVO leads). */
const respostas = $('Motor EVO').all().map(i => i.json).concat($input.all().map(i => i.json));
const ctx = $('Plano de coleta').first().json;
const juntar = (p) => { const o = []; for (const r of respostas) { if (r && r.rotulo && r.rotulo.indexOf(p + ':') === 0 && Array.isArray(r.itens)) o.push(...r.itens); } return o; };
const dia = (v) => (v ? String(v).slice(0, 10) : null);
const noPeriodo = (v, de, ate) => { const d = dia(v); return !!d && d >= de && d <= ate; };
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const unicos = (a) => Array.from(new Set(a));
const arred = (v, c) => (isFinite(v) ? Math.round(v * Math.pow(10, c)) / Math.pow(10, c) : null);

const membros = juntar('membros'), cancels = juntar('cancel'), vendas = juntar('vendas');
const recebiveis = juntar('receb'), atrasoBruto = juntar('atraso'), entradas = juntar('entradas');
const freq = juntar('freq'), prospects = juntar('prospects'), sessoes = juntar('sessoes');
const contratosBrutos = juntar('contratos');
const churnBruto = juntar('churn');

const iMes = ctx.inicioMes, fMes = ctx.fimMes, iSem = ctx.inicioSemana, fSem = ctx.fimSemana;
const hojeYMD = new Date(Date.now() - 10800000).toISOString().slice(0, 10);
const hoje = new Date(hojeYMD);
/* Data em que a base e fotografada. No fechamento e o ultimo dia do mes
   apurado, para o numero nao mudar conforme a hora em que o relatorio roda;
   na semana e hoje. */
const refBase = (ctx.escopo === 'mes' && fMes && fMes < hojeYMD) ? fMes : hojeYMD;

/* A /v1/members nao aceita filtro de status, entao a lista chega inteira (759
   cadastros) e o corte que a rota antiga fazia no servidor passa a ser feito
   aqui. status = cadastro ativo, o mesmo criterio do status=1 de antes. */
const porId = {};
for (const m of membros) {
  const id = m.idMember; if (!id || porId[id]) continue;
  if (String(m.status || '') !== 'Active') continue;
  porId[id] = m;
}
const cadastrados = Object.keys(porId).map(k => porId[k]);
/* Todos os cadastros, ativos ou nao: quem entrou e ja saiu continua tendo nome. */
const todosPorId = {};
for (const m of membros) { const id = m.idMember; if (id && !todosPorId[id]) todosPorId[id] = m; }

/* CONGELAMENTO. membershipStatus e um campo diferente de status, e os dois
   discordam de proposito: o aluno 16285 tem status "Active" (cadastro em pe) e
   membershipStatus "Suspended" (contrato congelado) ao mesmo tempo. Era essa
   diferenca que fazia a base fechar 18 alunos acima do painel da EVO.
   Congelado sai da base ativa mas NAO entra no churn: quem congela costuma
   voltar, e misturar com cancelamento esconde as duas coisas. Vira linha
   propria em base.congelados. */
const estaCongelado = (m) => String(m.membershipStatus || '') === 'Suspended';
const idCongelado = {};
for (const k of Object.keys(porId)) if (estaCongelado(porId[k])) idCongelado[k] = 1;

/* Quem a EVO considera com contrato de pe agora. Usado so para abrir a janela
   de virada de mes logo abaixo — nunca para incluir alguem sem contrato. */
const vigenteNaEvo = (id) => { const m = porId[id]; return !!m && String(m.membershipStatus || '') === 'Active'; };
const nomeDe = (id) => { const m = porId[id] || todosPorId[id]; const n = m ? ((m.firstName || '') + ' ' + (m.lastName || '')).trim() : ''; return n || ('id ' + id); };

const cancelMes = cancels.filter(c => noPeriodo(c.cancelDate, iMes, fMes));
const saiuNoMes = {};
for (const c of cancelMes) if (c.idMember) saiuNoMes[c.idMember] = 1;
const cancelamentos = Object.keys(saiuNoMes).length;

/* Regra do painel da EVO, reproduzida linha a linha:
   aluno ativo = cadastro ativo + contrato vigente (nao cancelado e ainda dentro da validade),
   fora VIP e fora cortesia. O contrato que termina hoje ja conta como vencido.
   Renovacao sobreposta do mesmo plano conta como um contrato so. */
/* VIRADA DO MES. Testamos uma janela de folga de 5 dias, achando que o contrato
   que vence em 31/08 e reabre em 01/09 caia no vao de um dia. Nao cai: o
   contrato que termina exatamente na data da foto ja conta (fim < refBase, nao
   <=). A folga so trazia de volta quem tinha PARADO — um aluno que ficou tres
   meses fora e voltou em setembro nao estava na base em agosto. Removida.
   Os 7 alunos que faltavam eram outra coisa: cinco eram VIP e dois tinham
   contrato VIP terminando em 31/08. Ver a nota do ehVip abaixo. */
const vistoC = {}; const vigentes = [];
for (const c of contratosBrutos) {
  const k = c.idMemberMemberShip; if (k && vistoC[k]) continue; if (k) vistoC[k] = 1;
  if (c.idBranch !== 54) continue;
  const fim = dia(c.membershipEnd);
  if (!fim || fim < refBase) continue;
  const ini = dia(c.membershipStart);
  if (ini && ini > refBase) continue;
  vigentes.push(c);
}
/* VIP CONTA NA BASE. O painel da EVO inclui PLANO RECORRENTE - VIP no numero de
   alunos ativos, e a lista que o Eduard exportou em 31/08/2026 confirma: os
   cinco VIPs estavam la. Sao alunos de verdade, treinam, ocupam vaga no tatame —
   so nao pagam mensalidade, e por isso entram com receita zero e nao mexem no
   MRR. Excluir era o que deixava a base cinco alunos abaixo do dashboard.
   O rotulo continua sendo apurado, mas agora so para informar quantos sao. */
const ehVip = (n) => String(n || '').toUpperCase().indexOf('VIP') >= 0;
/* Aluno ativo = cadastro ativo + contrato vigente, fora VIP. O valor do contrato
   NAO entra nessa conta: a EVO deixa saleValue vazio em parte dos contratos
   vigentes (39 pessoas em 01/09/2026, quase todas em planos recorrentes de 2025).
   Exigir valor > 0 empurrava essa gente para "cortesia" e derrubava a base de
   269 para 230. O valor ausente vira diagnostico, nao criterio de exclusao. */
const valem = vigentes.filter(c => porId[c.idMember] && !idCongelado[c.idMember]);
/* Congelados que tinham contrato vigente na data da foto — o numero que sai do
   ativo e vira linha propria no painel. */
const idCongeladoAtivo = {};
for (const c of vigentes) if (porId[c.idMember] && idCongelado[c.idMember]) idCongeladoAtivo[c.idMember] = 1;
const congelados = Object.keys(idCongeladoAtivo).length;
const listaCongelados = Object.keys(idCongeladoAtivo).map(id => ({ aluno: nomeDe(id) }));
const contratosSemValor = valem.filter(c => num(c.saleValue) <= 0).length;
const porChave = {};
for (const c of valem) {
  const chave = c.idMember + '|' + (c.nameMembership || '').trim().toUpperCase();
  const atual = porChave[chave];
  if (!atual || dia(c.membershipEnd) > dia(atual.membershipEnd)) porChave[chave] = c;
}
const contratosAtivos = Object.keys(porChave).map(k => porChave[k]);

/* Duracao mediana de cada plano, para achar contrato esticado. */
const duracaoDe = (c) => {
  const i = dia(c.membershipStart), f = dia(c.membershipEnd);
  if (!i || !f) return null;
  const a = Date.parse(i + 'T12:00:00Z'), b = Date.parse(f + 'T12:00:00Z');
  if (!isFinite(a) || !isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
};
const durPorPlano = {};
for (const c of contratosAtivos) {
  const d = duracaoDe(c); if (d === null) continue;
  const n = (c.nameMembership || '').trim();
  if (!durPorPlano[n]) durPorPlano[n] = [];
  durPorPlano[n].push(d);
}
const medianaPlano = {};
for (const n of Object.keys(durPorPlano)) {
  const v = durPorPlano[n].slice().sort((a, b) => a - b);
  medianaPlano[n] = v[Math.floor(v.length / 2)];
}
const esticados = [];
for (const c of contratosAtivos) {
  const d = duracaoDe(c); if (d === null) continue;
  const n = (c.nameMembership || '').trim();
  const limite = Math.max(35, (medianaPlano[n] || 30) * 1.6);
  if (d <= limite) continue;
  esticados.push({ aluno: nomeDe(c.idMember), plano: n,
    inicio: dia(c.membershipStart), fim: dia(c.membershipEnd), dias: d });
}
esticados.sort((a, b) => b.dias - a.dias);
const idAtivo = {}; for (const c of contratosAtivos) idAtivo[c.idMember] = 1;
const ativos = Object.keys(idAtivo).map(k => porId[k]);
const alunos = ativos.length;
const contratos = contratosAtivos.length;
const renovacoesSobrepostas = valem.length - contratos;
/* Cortesia agora e so um rotulo: quem esta na base por plano VIP. Nao sai da
   conta — o numero serve para saber quanto do tatame nao gera mensalidade. */
const idCortesia = {};
for (const c of valem) { if (ehVip(c.nameMembership)) idCortesia[c.idMember] = 1; }
const emCortesia = Object.keys(idCortesia).length;
const semContrato = cadastrados.length - alunos - congelados;

const contagem = {}, planosDoAluno = {};
for (const c of contratosAtivos) {
  contagem[c.idMember] = (contagem[c.idMember] || 0) + 1;
  if (!planosDoAluno[c.idMember]) planosDoAluno[c.idMember] = [];
  planosDoAluno[c.idMember].push((c.nameMembership || 'Sem nome').trim());
}
const multiplos = [];
for (const k of Object.keys(contagem)) { if (contagem[k] > 1) multiplos.push({ aluno: nomeDe(k), contratos: contagem[k], planos: planosDoAluno[k] }); }
multiplos.sort((a, b) => b.contratos - a.contratos);

/* MATRICULAS DO MES
   Antes so contavamos quem continua ativo hoje (idAtivo). Quem entrou e saiu
   dentro do mesmo mes sumia dos "novos" mas aparecia nos cancelamentos, o que
   inflava a base do inicio do mes e escondia matricula bruta. Agora:
   novo    = cadastro criado dentro do mes, tenha ele ficado ou nao;
   retorno = quem ja era cadastrado antes e comprou plano no balcao neste mes. */
const vendasBalcao = vendas.filter(v => !v.idSaleRecurrency && noPeriodo(v.saleDate, iMes, fMes));
/* 06/10/2026: o filtro dizia "tenha ele ficado ou nao", mas lia so os cadastros
   ATIVOS — quem entrou e saiu (ou ficou inativo) depois sumia dos novos e o
   fechamento do mes mudava conforme o dia em que rodava (setembro: 15 em 01/10,
   14 em 05/10, por causa do Pablo). Agora: novo = cadastro criado no periodo que
   tem contrato de pe hoje (ativo ou congelado) OU comprou plano no periodo.
   Cadastro convertido sem venda (ex.: irmaos Ruaro, 30/09) nao e matricula. */
const comprouPlano = {};
for (const v of vendas) {
  if (!v || !v.idMember) continue;
  if ((Array.isArray(v.saleItens) ? v.saleItens : []).some(it => it && it.idMembership)) {
    const d = dia(v.saleDate); if (d && (!comprouPlano[v.idMember] || d < comprouPlano[v.idMember])) comprouPlano[v.idMember] = d;
  }
}
const ehMatriculado = (id, de, ate) => !!(idAtivo[id] || idCongeladoAtivo[id] || (comprouPlano[id] && comprouPlano[id] >= de && comprouPlano[id] <= ate));
const idsNovos = [], idsRetorno = [];
for (const k of Object.keys(todosPorId)) {
  const m = todosPorId[k];
  if (m.idMember && noPeriodo(m.registerDate, iMes, fMes) && ehMatriculado(m.idMember, iMes, fMes)) idsNovos.push(m.idMember);
}
const ehNovoDoMes = {};
for (const id of idsNovos) ehNovoDoMes[id] = 1;
for (const v of vendasBalcao) {
  const m = porId[v.idMember]; if (!m) continue;
  if (ehNovoDoMes[v.idMember]) continue;
  if (!idAtivo[v.idMember]) continue;
  idsRetorno.push(v.idMember);
}
const novos = unicos(idsNovos).length;
/* Pessoas ja cadastradas antes do mes com venda avulsa no mes. NAO e retorno:
   a EVO registra a cobranca mensal do plano recorrente como venda avulsa e
   nao expoe campo que separe as duas coisas. Fica como diagnostico. */
const vendasAvulsasDeAtivos = unicos(idsRetorno).length;
/* Retorno de ex-aluno exige saber quem ficou sem contrato e voltou, e o
   historico de contratos vencidos nao vem na API. Enquanto nao medirmos,
   o campo vale zero e a marca abaixo diz por que. */
const retornos = 0;
const novosQueFicaram = unicos(idsNovos.filter(id => idAtivo[id])).length;
const alunosInicio = alunos - novos + cancelamentos;

const motivos = {}, coortes = { 'ate 3 meses': 0, '3 a 12 meses': 0, 'mais de 12 meses': 0, 'sem data': 0 };
for (const c of cancelMes) {
  const mot = (c.reasonCancellation || 'Nao informado').trim();
  motivos[mot] = (motivos[mot] || 0) + 1;
  const m = porId[c.idMember];
  const nasc = m && m.registerDate ? dia(m.registerDate) : dia(c.membershipStart);
  const fim = dia(c.cancelDate);
  if (!nasc || !fim) { coortes['sem data']++; continue; }
  const meses = (new Date(fim) - new Date(nasc)) / 2592000000;
  if (meses <= 3) coortes['ate 3 meses']++; else if (meses <= 12) coortes['3 a 12 meses']++; else coortes['mais de 12 meses']++;
}

const mrr = recebiveis.filter(r => !r.cancellationDate && idAtivo[r.idMemberPayer]).reduce((s, r) => s + num(r.ammount), 0);
const vistos = {}, atrasados = [];
for (const r of atrasoBruto.concat(recebiveis)) {
  if (!r || r.cancellationDate) continue;
  if (!idAtivo[r.idMemberPayer]) continue;
  const id = r.idReceivable; if (id && vistos[id]) continue; if (id) vistos[id] = 1;
  const venc = dia(r.dueDate); if (!venc || venc >= hojeYMD) continue;
  const falta = num(r.ammount) - num(r.ammountPaid);
  if (falta <= 0.99) continue;
  atrasados.push({ falta, id: r.idMemberPayer, dias: Math.floor((hoje - new Date(venc)) / 86400000) });
}
const valorInad = atrasados.reduce((s, r) => s + r.falta, 0);
const inadimplentes = unicos(atrasados.map(r => r.id).filter(Boolean)).length;
const aging = { 'ate 30 dias': 0, '31 a 60 dias': 0, '61 a 90 dias': 0, 'mais de 90 dias': 0 };
for (const r of atrasados) {
  if (r.dias <= 30) aging['ate 30 dias'] += r.falta; else if (r.dias <= 60) aging['31 a 60 dias'] += r.falta;
  else if (r.dias <= 90) aging['61 a 90 dias'] += r.falta; else aging['mais de 90 dias'] += r.falta;
}
for (const k of Object.keys(aging)) aging[k] = arred(aging[k], 2);

const planoMap = {};
for (const c of contratosAtivos) {
  const nome = (c.nameMembership || 'Sem nome').trim();
  if (!planoMap[nome]) planoMap[nome] = { nome, alunos: [], vendas: 0, receita: 0, sem_valor: 0 };
  if (num(c.saleValue) <= 0) planoMap[nome].sem_valor += 1;
  planoMap[nome].alunos.push(c.idMember);
  planoMap[nome].receita += num(c.saleValue);
  if (noPeriodo(c.saleDate, iMes, fMes)) planoMap[nome].vendas += 1;
}
/* Planos VENDIDOS no mes, com quem assinou a venda. Diferente do mix de planos,
   que mostra onde a base esta hoje: aqui e o que entrou agora. */
const vendidosMap = {}, vendedorPlano = {};
for (const v of vendas) {
  if (!noPeriodo(v.saleDate, iMes, fMes)) continue;
  const quem = (v.nameEmployeeSale || 'Sem vendedor').trim();
  for (const it of (Array.isArray(v.saleItens) ? v.saleItens : [])) {
    if (!it.idMembership) continue;
    const nome = (it.item || it.description || 'Sem nome').trim();
    const valor = num(it.saleValue) || num(it.itemValue);
    const novo = !v.idSaleRecurrency;
    if (!vendidosMap[nome]) vendidosMap[nome] = { nome, vendas: 0, novas: 0, renovacoes: 0, receita: 0 };
    vendidosMap[nome].vendas += 1;
    if (novo) vendidosMap[nome].novas += 1; else vendidosMap[nome].renovacoes += 1;
    vendidosMap[nome].receita += valor;
    if (!novo) continue;
    if (!vendedorPlano[quem]) vendedorPlano[quem] = { vendedor: quem, vendas: 0, receita: 0, planos: {} };
    vendedorPlano[quem].vendas += 1;
    vendedorPlano[quem].receita += valor;
    vendedorPlano[quem].planos[nome] = (vendedorPlano[quem].planos[nome] || 0) + 1;
  }
}
const planosVendidos = Object.keys(vendidosMap).map(k => ({ nome: vendidosMap[k].nome, vendas: vendidosMap[k].vendas,
  novas: vendidosMap[k].novas, renovacoes: vendidosMap[k].renovacoes, receita: arred(vendidosMap[k].receita, 2) }))
  .sort((a, b) => b.novas - a.novas || b.vendas - a.vendas);

const servicoMap = {}, produtoMap = {};
for (const v of vendas) {
  if (!noPeriodo(v.saleDate, iMes, fMes)) continue;
  for (const it of (Array.isArray(v.saleItens) ? v.saleItens : [])) {
    if (it.idMembership) continue;
    const nome = (it.item || it.description || 'Sem nome').trim();
    const alvo = it.idProduct ? produtoMap : servicoMap;
    if (!alvo[nome]) alvo[nome] = { nome, alunos: [], vendas: 0, receita: 0 };
    alvo[nome].alunos.push(v.idMember);
    alvo[nome].receita += num(it.saleValue) || num(it.itemValue);
    alvo[nome].vendas += 1;
  }
}
const arruma = (mp) => Object.keys(mp).map(k => ({ nome: mp[k].nome, alunos: unicos(mp[k].alunos.filter(Boolean)).length, vendas: mp[k].vendas, receita: arred(mp[k].receita, 2), sem_valor: mp[k].sem_valor || 0 })).sort((a, b) => b.alunos - a.alunos);
const planos = arruma(planoMap);
const servicos = arruma(servicoMap);
const produtos = arruma(produtoMap);
const receitaServicos = servicos.reduce((t, x) => t + num(x.receita), 0);
const receitaProdutos = produtos.reduce((t, x) => t + num(x.receita), 0);

const leadsMes = prospects.filter(p => noPeriodo(p.registerDate, iMes, fMes)).length;
const canais = {};
for (const p of prospects) { if (!noPeriodo(p.registerDate, iMes, fMes)) continue; const c = (p.mktChannel || 'Nao informado').trim(); canais[c] = (canais[c] || 0) + 1; }

const naSemana = (s) => noPeriodo(s.activityDate, iSem, fSem);
const sessoesSem = sessoes.filter(naSemana);

/* AULA EXPERIMENTAL / INTRODUTORIA
   Ela nao aparece em /v1/activities/schedule: aquela rota devolve so turmas em
   grupo. A experimental e um agendamento individual e sai por pessoa em
   /v2/activities/member/sessions. Enquanto e lead, sai por idProspect; depois que
   matricula, so sai por idMember. Lemos os dois lados e juntamos. */
const nomeAula = (n) => String(n || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/* Aula lancada no nome da escola era do Alessandro, colaborador que ainda nao tinha
   cadastro na epoca. Enquanto houver lancamento antigo assim, ela e dele. */
const APELIDO_PROF = { 'ALLIANCE JIU JITSU': 'ALESSANDRO DOMINGOS' };
const nomeProf = (n) => { const x = String(n || '').trim(); return APELIDO_PROF[x.toUpperCase()] || x || 'Sem professor'; };
/* Valor pago ao professor por aula dada, coletiva ou individual. */
const VALOR_AULA = 30;
/* No exame de faixa o professor recebe um terco do valor cobrado. */
const FATIA_EXAME = 1 / 3;
const ehAulaIndividual = (n) => { const x = nomeAula(n);
  return x.indexOf('experimental') >= 0 || x.indexOf('introdut') >= 0 || /\baula\s*[123]\b/.test(x); };
/* "Aula 2 | Introdutoria" e "Aula 3 | Introdutoria" NAO sao primeiro contato: sao aulas
   da metodologia da casa para quem ja matriculou. Contam na folha do professor, porque
   sao aula dada, mas ficam fora do funil, da conversao e do no-show. */
const ehComplementar = (n) => /\b(?:aula|introdutoria)\s*[|\-]?\s*[23]\b/.test(nomeAula(n));

/* PONTE LEAD -> ALUNO
   A EVO nunca preenche idMember nem conversionDate no cadastro do lead. Tres
   pontes, da mais forte para a mais fraca: a entrada de agendamento, que traz os
   dois ids na mesma linha; o contato (celular e e-mail moram em member.contacts,
   nao nos campos soltos do cadastro); e o nome normalizado. */
const soDigitos = (v) => String(v || '').replace(/[^0-9]/g, '');
const chaveFone = (v) => { const d = soDigitos(v); return d.length >= 10 ? d.slice(-10) : ''; };
const chaveMail = (v) => String(v || '').trim().toLowerCase();
const limpaNome = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '')
  .toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const nomeInteiro = (o) => limpaNome((o.firstName || '') + ' ' + (o.lastName || ''));
const contatosDoMembro = (m) => {
  const f = [], lista = Array.isArray(m.contacts) ? m.contacts : [];
  for (const c of lista) {
    const d = c && c.description; if (!d) continue;
    if (String(d).indexOf('@') > 0) { f.push('e:' + chaveMail(d)); continue; }
    const k = chaveFone(d); if (k) f.push('f:' + k);
  }
  return f;
};
const contatosDoLead = (p) => {
  const f = [];
  for (const c of [p.cellphone, p.phone, p.telephone, p.mobilePhone]) { const k = chaveFone(c); if (k) f.push('f:' + k); }
  const e = chaveMail(p.email); if (e && e.indexOf('@') > 0) f.push('e:' + e);
  return f;
};
const contatoDoAtivo = {}, nomeDoAtivo = {};
for (const m of ativos) {
  for (const k of contatosDoMembro(m)) contatoDoAtivo[k] = m.idMember;
  const n = nomeInteiro(m); if (n && !nomeDoAtivo[n]) nomeDoAtivo[n] = m.idMember;
}
const convertido = {}, alunoDoLead = {}, ponte = { entrada: 0, contato: 0, nome: 0 };
const casa = (idp, idm, via) => { if (!idp || !idm || alunoDoLead[idp]) return; convertido[idp] = 1; alunoDoLead[idp] = idm; ponte[via] += 1; };
for (const e of freq.concat(entradas)) { if (e && e.idProspect && e.idMember) casa(e.idProspect, e.idMember, 'entrada'); }
for (const p of prospects) {
  const idp = p.idProspect; if (!idp || alunoDoLead[idp]) continue;
  if (p.idMember) { casa(idp, p.idMember, 'entrada'); continue; }
  for (const k of contatosDoLead(p)) { if (contatoDoAtivo[k]) { casa(idp, contatoDoAtivo[k], 'contato'); break; } }
  if (alunoDoLead[idp]) continue;
  const n = nomeInteiro(p); if (n && nomeDoAtivo[n]) casa(idp, nomeDoAtivo[n], 'nome');
}
const leadsCasadosPorContato = Object.keys(alunoDoLead).length;

const agendaBruta = [], leadsConsultados = {};
/* Quantas pessoas a fase 2 queria consultar e quantas o teto de tempo deixou.
   Se cortou, o funil da experimental esta incompleto e o painel precisa dizer. */
let filaTotal = 0, filaCortada = 0;
try {
  const plano = $('Agenda dos leads').all().map(i => i.json);
  for (const r of plano) {
    if (r && r.filaTotal) { filaTotal = Number(r.filaTotal) || 0; filaCortada = Number(r.filaCortada) || 0; break; }
  }
} catch (e) { filaTotal = 0; filaCortada = 0; }
for (const r of respostas) {
  if (!r || !r.rotulo) continue;
  const rot = String(r.rotulo);
  const ehP = rot.indexOf('agendaP:') === 0, ehM = rot.indexOf('agendaM:') === 0;
  if (!ehP && !ehM) continue;
  const id = rot.split(':')[1];
  const idMembro = ehM ? Number(id) : (alunoDoLead[id] || null);
  leadsConsultados[(ehM ? 'm' : 'p') + id] = 1;
  if (!Array.isArray(r.itens)) continue;
  for (const x of r.itens) {
    if (!x || !x.date || !ehAulaIndividual(x.activitieName)) continue;
    agendaBruta.push({ idProspect: ehP ? id : null, idMember: idMembro,
      data: dia(x.date), hora: x.startTime || '',
      professor: nomeProf(x.instructor),
      atividade: (x.activitieName || '').trim(),
      complementar: ehComplementar(x.activitieName),
      presente: !!x.presenca, falta: !!x.falta, justificada: !!x.faltaJustificada,
      finalizada: !!x.isFinalized,
      sessao: x.idActivitieSession });
  }
}
/* A mesma aula volta pelos dois lados quando o lead ja virou aluno. Dedup pela
   sessao mais a pessoa, para nao contar a experimental duas vezes. */
const pessoaChave = (a) => (a.idMember ? 'm' + a.idMember : 'p' + a.idProspect);
const vistaSessao = {}, experimentais = [];
for (const a of agendaBruta) {
  const k = a.sessao + '|' + a.data + '|' + pessoaChave(a);
  if (vistaSessao[k]) continue; vistaSessao[k] = 1;
  experimentais.push(a);
}
experimentais.sort((a, b) => String(b.data).localeCompare(String(a.data)));

const noRecorte = (de, ate) => experimentais.filter(a => a.data && a.data >= de && a.data <= ate);
const indSem = noRecorte(iSem, fSem), indMes = noRecorte(iMes, fMes);
const expSem = indSem.filter(a => !a.complementar);
const expMes = indMes.filter(a => !a.complementar);

/* MATRICULAS QUE NAO PASSARAM POR EXPERIMENTAL.
   Em agosto/2026 entraram 14 alunos e so 5 vieram de experimental. Os outros 9
   ou chegaram por um caminho que ninguem esta olhando — indicacao direta, irmao
   de aluno, ex-aluno voltando — ou fizeram experimental sem lancamento na grade.
   As duas respostas mudam decisao, e nenhuma aparece hoje. Esta lista poe nome
   nelas todo mes, para a recepcao conferir uma a uma. */
const fezExperimental = {};
for (const a of expMes) {
  const idm = a.idMember || (a.idProspect ? alunoDoLead[a.idProspect] : null);
  if (idm) fezExperimental[idm] = 1;
}
const matriculasSemExperimental = unicos(idsNovos)
  .filter(id => !fezExperimental[id])
  .map(id => { const m = todosPorId[id] || {};
    return { aluno: nomeDe(id), entrou: dia(m.registerDate), canal: (m.mktChannel || '').trim() || null }; })
  .sort((a, b) => String(a.entrou).localeCompare(String(b.entrou)));
const compMes = indMes.filter(a => a.complementar);
/* Matriculou = a pessoa que fez a experimental tem contrato de pe hoje ou comprou
   plano depois da aula. 06/10/2026: antes era so "ativo hoje" — quem comprou e ja
   saiu deixava de contar, e o fechamento do mes mudava com a data da coleta. */
const ehAlunoHoje = (a) => !!(a.idMember && (idAtivo[a.idMember] || idCongeladoAtivo[a.idMember]
  || (comprouPlano[a.idMember] && comprouPlano[a.idMember] >= String(a.data || ''))));
const primeiraDe = (l) => { const p = {}; for (const a of l) { const k = pessoaChave(a); if (!p[k] || a.data < p[k].data) p[k] = a; } return p; };
const contaExp = (l) => {
  const p = primeiraDe(l), pessoas = Object.keys(p).map(k => p[k]);
  /* a EVO devolve presenca=true ja no agendamento, inclusive para aula futura;
     quem separa aula dada de aula marcada e isFinalized */
  return { agendadas: l.length,
    agendadas_futuras: l.filter(a => !a.finalizada).length,
    realizadas: l.filter(a => a.presente && a.finalizada).length,
    faltas: l.filter(a => a.falta && !a.justificada).length,
    faltas_justificadas: l.filter(a => a.justificada).length,
    pessoas: pessoas.length,
    matriculas: pessoas.filter(ehAlunoHoje).length };
};
const expNoMes = contaExp(expMes), expNaSemana = contaExp(expSem);

const agendadas = expNoMes.agendadas;
const realizadas = expNoMes.realizadas;

/* Conversao por professor. As aulas contam por sessao; a matricula conta por
   pessoa e vai para quem deu a PRIMEIRA experimental dela — foi quem recebeu. */
const tabelaProf = (lista) => {
  const map = {};
  const abre = (n) => { if (!map[n]) map[n] = { nome: n, agendadas: 0, realizadas: 0, faltas: 0, fechadas: 0 }; return map[n]; };
  for (const a of lista) {
    const p = abre(a.professor);
    p.agendadas += 1;
    if (a.presente && a.finalizada) p.realizadas += 1;
    if (a.falta && !a.justificada) p.faltas += 1;
  }
  const primeiras = primeiraDe(lista);
  for (const k of Object.keys(primeiras)) {
    const a = primeiras[k];
    if (ehAlunoHoje(a)) abre(a.professor).fechadas += 1;
  }
  return Object.keys(map).map(k => {
    const p = map[k];
    return { nome: p.nome, agendadas: p.agendadas, realizadas: p.realizadas, faltas: p.faltas,
      fechadas: p.fechadas, conversao: p.realizadas > 0 ? arred(p.fechadas / p.realizadas * 100, 1) : null };
  }).sort((a, b) => b.realizadas - a.realizadas);
};
/* Duas leituras do mesmo funil: o mes fecha resultado, a semana mostra o ritmo.
   Na semana a conversao quase sempre parece pior, porque a matricula costuma
   vir dias depois da aula — por isso as duas convivem, nao se substituem. */
const professores = tabelaProf(expMes);
const professoresSemana = tabelaProf(expSem);

/* Vendedores: quem assinou a venda de plano novo, com o mix que cada um vende. */
const vendedores = Object.keys(vendedorPlano).map(k => {
  const v = vendedorPlano[k];
  const ps = Object.keys(v.planos).sort((a, b) => v.planos[b] - v.planos[a]);
  return { nome: v.vendedor, vendas: v.vendas, receita: arred(v.receita, 2),
    ticket: v.vendas > 0 ? arred(v.receita / v.vendas, 2) : null,
    planos: ps.map(p => p + ' (' + v.planos[p] + ')') };
}).sort((a, b) => b.vendas - a.vendas);

/* Quem deu aula na semana, quais modalidades e quanta gente apareceu. Sai da grade. */
const gradeProf = {}, gradeMod = {};
for (const s of sessoesSem) {
  const p = nomeProf(s.instructor);
  const mod = (s.name || 'Sem nome').trim();
  if (!gradeProf[p]) gradeProf[p] = { professor: p, aulas: 0, presencas: 0, modalidades: {} };
  gradeProf[p].aulas += 1;
  gradeProf[p].presencas += Math.max(num(s.ocupation), 0);
  gradeProf[p].modalidades[mod] = (gradeProf[p].modalidades[mod] || 0) + 1;
  if (!gradeMod[mod]) gradeMod[mod] = { modalidade: mod, aulas: 0, presencas: 0, capacidade: 0, professores: {} };
  gradeMod[mod].aulas += 1;
  gradeMod[mod].presencas += Math.max(num(s.ocupation), 0);
  gradeMod[mod].capacidade += num(s.capacity);
  gradeMod[mod].professores[p] = (gradeMod[mod].professores[p] || 0) + 1;
}
const nomeLista = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]).map(k => k + ' (' + o[k] + ')');
const aulasPorProfessor = Object.keys(gradeProf).map(k => {
  const g = gradeProf[k];
  return { professor: g.professor, aulas: g.aulas, presencas: g.presencas,
    media_por_aula: g.aulas > 0 ? arred(g.presencas / g.aulas, 1) : null,
    modalidades: nomeLista(g.modalidades) };
}).sort((a, b) => b.aulas - a.aulas);
const aulasPorModalidade = Object.keys(gradeMod).map(k => {
  const g = gradeMod[k];
  return { modalidade: g.modalidade, aulas: g.aulas, presencas: g.presencas,
    media_por_aula: g.aulas > 0 ? arred(g.presencas / g.aulas, 1) : null,
    ocupacao: g.capacidade > 0 ? arred(g.presencas / g.capacidade * 100, 1) : null,
    professores: nomeLista(g.professores) };
}).sort((a, b) => b.aulas - a.aulas);

/* CHURN DETALHADO — doze meses de cancelamentos.
   A EVO nao expoe quem registrou o cancelamento nem a lista de suspensos:
   /v3/membermembership so aceita statusMemberMembership 1 e 2, e /v2/members
   devolve a mesma lista para qualquer status diferente de 1. */
const vistoCh = {}, cancelAno = [];
for (const c of churnBruto.concat(cancels)) {
  const k = c.idMemberMemberShip; if (k && vistoCh[k]) continue; if (k) vistoCh[k] = 1;
  if (c.idBranch !== 54 || !c.cancelDate) continue;
  const fim = dia(c.cancelDate);
  const ini = dia(c.membershipStart) || dia(c.saleDate);
  const meses = (ini && fim) ? Math.max(0, arred((new Date(fim) - new Date(ini)) / 2592000000, 1)) : null;
  cancelAno.push({ aluno: (c.name || '').trim(), data: fim, plano: (c.nameMembership || '').trim(),
    motivo: (c.reasonCancellation || 'Nao informado').trim(), valor: num(c.saleValue),
    meses_no_contrato: meses, multa: num(c.cancellationFine) });
}
cancelAno.sort((a, b) => String(b.data).localeCompare(String(a.data)));

/* COORTES DE ENTRADA — sobrevivencia aos primeiros 90 dias.
   O numero de cancelamentos do mes nao responde a pergunta que importa, porque
   mistura quem entrou ontem com quem entrou em 2021. Isto responde: de quem
   entrou em junho, quantos ainda estavam aqui 90 dias depois.
   Custa zero chamada nova: a lista /v1/members ja vem inteira (759 cadastros,
   ativos e inativos) desde que trocamos a rota por causa do congelamento.
   Regra: sobreviveu quem cancelou 90 dias ou mais depois de entrar, ou quem
   segue ativo hoje. Coorte com menos de 90 dias de idade nao entra na conta —
   ainda nao deu tempo de saber. */
const JANELA_COORTE = 90;
const cancelPorMembro = {};
for (const c of churnBruto.concat(cancels)) {
  if (c.idBranch !== 54 || !c.cancelDate || !c.idMember) continue;
  const d = dia(c.cancelDate);
  if (!cancelPorMembro[c.idMember] || d < cancelPorMembro[c.idMember]) cancelPorMembro[c.idMember] = d;
}
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
const fimDoMes = (ym) => { const p = ym.split('-'); const d = new Date(Date.UTC(+p[0], +p[1], 0)); return d.toISOString().slice(0, 10); };
const limiteCoorte = String(new Date(new Date(hojeYMD + 'T12:00:00Z').getTime() - 400 * 86400000).toISOString()).slice(0, 7);
const coortesMapa = {};
for (const m of membros) {
  const id = m.idMember, nasc = dia(m.registerDate);
  if (!id || !nasc) continue;
  const chave = nasc.slice(0, 7);
  if (chave < limiteCoorte) continue;
  /* A turma so entra na conta quando o MES INTEIRO ja completou a janela. Medir
     por pessoa deixava o mes mais recente entrar pela metade — junho/2026
     aparecia com 1 aluno, que eram so os dois ultimos dias do mes, e uma turma
     de 1 pessoa com 100% de sobrevivencia polui a leitura. */
  if (diasEntre(fimDoMes(chave), hojeYMD) < JANELA_COORTE) continue;
  const c = coortesMapa[chave] || (coortesMapa[chave] = { mes: chave, entraram: 0, sobreviveram: 0 });
  c.entraram++;
  const cd = cancelPorMembro[id];
  if (cd) { if (diasEntre(nasc, cd) >= JANELA_COORTE) c.sobreviveram++; }
  else if (String(m.status || '') === 'Active') c.sobreviveram++;
}
const coortesEntrada = Object.keys(coortesMapa).sort().map(k => {
  const c = coortesMapa[k];
  return { mes: c.mes, entraram: c.entraram, sobreviveram: c.sobreviveram,
    perderam: c.entraram - c.sobreviveram,
    sobrevivencia: c.entraram > 0 ? arred(c.sobreviveram / c.entraram * 100, 1) : null };
});
const coorteResumo = (() => {
  const t = coortesEntrada.reduce((a, c) => ({ e: a.e + c.entraram, s: a.s + c.sobreviveram }), { e: 0, s: 0 });
  return { janela_dias: JANELA_COORTE, entraram: t.e, sobreviveram: t.s, perderam: t.e - t.s,
    sobrevivencia: t.e > 0 ? arred(t.s / t.e * 100, 1) : null,
    meses_medidos: coortesEntrada.length };
})();

const churnPorMes = {}, churnMotivos = {}, churnValor = {};
for (const c of cancelAno) {
  const m = String(c.data).slice(0, 7);
  churnPorMes[m] = (churnPorMes[m] || 0) + 1;
  churnValor[m] = arred((churnValor[m] || 0) + c.valor, 2);
  churnMotivos[c.motivo] = (churnMotivos[c.motivo] || 0) + 1;
}
/* Quais planos perdem gente. O tempo de casa do aluno nao da para calcular aqui:
   o cadastro de quem saiu nao volta mais na lista de membros, e membershipStart e o
   inicio do CICLO do contrato, nao a data em que a pessoa entrou na escola. */
const churnPlano = {};
for (const c of cancelAno) {
  const p = c.plano || 'Sem plano';
  if (!churnPlano[p]) churnPlano[p] = { plano: p, cancelamentos: 0, valor: 0 };
  churnPlano[p].cancelamentos += 1;
  churnPlano[p].valor += c.valor;
}
const porPlanoChurn = Object.keys(churnPlano).map(k => ({ plano: churnPlano[k].plano,
  cancelamentos: churnPlano[k].cancelamentos, valor: arred(churnPlano[k].valor, 2) }))
  .sort((a, b) => b.cancelamentos - a.cancelamentos);

const mesesOrd = Object.keys(churnPorMes).sort();
const serieChurn = mesesOrd.map(m => ({ mes: m, cancelamentos: churnPorMes[m], valor_perdido: churnValor[m] }));
const mediaMes = serieChurn.length ? arred(cancelAno.length / serieChurn.length, 1) : null;
const piorMes = serieChurn.slice().sort((a, b) => b.cancelamentos - a.cancelamentos)[0] || null;
const churn = {
  janela: '12 meses', total: cancelAno.length,
  serie_mensal: serieChurn, motivos: churnMotivos, por_plano: porPlanoChurn,
  media_por_mes: mediaMes, pior_mes: piorMes,
  perda_total: arred(cancelAno.reduce((t, c) => t + c.valor, 0), 2),
  multas_cobradas: arred(cancelAno.reduce((t, c) => t + c.multa, 0), 2),
  lista: cancelAno.slice(0, 60),
  suspensos_indisponiveis: true,
  responsavel_indisponivel: true
};

/* Fechamento do mes por professor: base do pagamento por aula dada. */
/* 06/10/2026: no mes em curso a coleta roda as 5h e o fim do periodo e HOJE — as
   aulas de hoje ainda nao aconteceram e entravam na folha. So conta ate ontem. */
const ontemYMD = new Date(new Date(hojeYMD + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
const fimFolha = fMes < hojeYMD ? fMes : ontemYMD;
const sessoesMes = sessoes.filter(s => noPeriodo(s.activityDate, iMes, fimFolha));
const folhaMap = {};
for (const s of sessoesMes) {
  const p = nomeProf(s.instructor);
  if (!folhaMap[p]) folhaMap[p] = { professor: p, coletivas: 0, introdutorias: 0, complementares: 0, presencas: 0, modalidades: {} };
  folhaMap[p].coletivas += 1;
  folhaMap[p].presencas += Math.max(num(s.ocupation), 0);
  const mod = (s.name || 'Sem nome').trim();
  folhaMap[p].modalidades[mod] = (folhaMap[p].modalidades[mod] || 0) + 1;
}
/* Aula individual dada no mes entra na folha pelo mesmo valor por aula. A experimental
   e a complementar da metodologia vao em colunas separadas: as duas se pagam, mas so a
   primeira conta como funil. */
for (const a of indMes) {
  /* presenca=true vem ja no agendamento: aula de hoje em diante e falta nao se pagam.
     Aula passada que ninguem finalizou continua contando, como antes. */
  if (!a.presente || a.falta || (!a.finalizada && !(a.data && a.data < hojeYMD))) continue;
  const p = a.professor;
  if (!folhaMap[p]) folhaMap[p] = { professor: p, coletivas: 0, introdutorias: 0, complementares: 0, presencas: 0, modalidades: {} };
  if (a.complementar) folhaMap[p].complementares = (folhaMap[p].complementares || 0) + 1;
  else folhaMap[p].introdutorias += 1;
}
const folha = Object.keys(folhaMap).map(k => {
  const f = folhaMap[k];
  const comp = f.complementares || 0;
  const aulas = f.coletivas + f.introdutorias + comp;
  return { professor: f.professor, coletivas: f.coletivas, introdutorias: f.introdutorias,
    complementares: comp, aulas: aulas, presencas: f.presencas,
    valorAulas: arred(aulas * VALOR_AULA, 2),
    modalidades: nomeLista(f.modalidades) };
}).sort((a, b) => b.aulas - a.aulas);

/* Exames e particulares: a EVO registra a VENDA, nao quem aplicou. Vao como
   linha a ratear na mao ate a atividade ser lancada na grade com professor. */
/* EXA?ME cobre o item cadastrado com erro de digitacao: "EXME DE FAIXA ADU - MARROM" */
const temExame = (n) => /EXA?ME/.test(String(n || '').toUpperCase());
const temPersonal = (n) => String(n || '').toUpperCase().indexOf('PERSONAL') >= 0;
const exames = servicos.filter(x => temExame(x.nome));
const particulares = servicos.filter(x => temPersonal(x.nome));
const personalRec = planos.filter(x => temPersonal(x.nome));
const temAluguel = (n) => String(n || '').toUpperCase().indexOf('ALUGUEL') >= 0;
const temAvulsa = (n) => { const x = String(n || '').toUpperCase(); return x.indexOf('AULA AVULSA') >= 0; };
const temMulta = (n) => String(n || '').toUpperCase().indexOf('MULTA') >= 0;
const temExperimental = (n) => String(n || '').toUpperCase().indexOf('EXPERIMENTAL') >= 0;
const soma = (l, c) => arred(l.reduce((t, x) => t + num(x[c]), 0), 2);
const conta = (l) => l.reduce((t, x) => t + num(x.vendas), 0);

const alugueis = servicos.filter(x => temAluguel(x.nome));
const avulsas = servicos.filter(x => temAvulsa(x.nome));
const multas = servicos.filter(x => temMulta(x.nome));
const experimentais_vendidas = servicos.filter(x => temExperimental(x.nome));
const outrosServ = servicos.filter(x => !temExame(x.nome) && !temPersonal(x.nome) && !temAluguel(x.nome)
  && !temAvulsa(x.nome) && !temMulta(x.nome) && !temExperimental(x.nome));

const categorias = [
  { categoria: 'Aula particular (personal)', itens: particulares, vendas: conta(particulares), receita: soma(particulares, 'receita') },
  { categoria: 'Exame de faixa', itens: exames, vendas: conta(exames), receita: soma(exames, 'receita') },
  { categoria: 'Aula avulsa', itens: avulsas, vendas: conta(avulsas), receita: soma(avulsas, 'receita') },
  { categoria: 'Aluguel de kimono', itens: alugueis, vendas: conta(alugueis), receita: soma(alugueis, 'receita') },
  { categoria: 'Multa de cancelamento', itens: multas, vendas: conta(multas), receita: soma(multas, 'receita') },
  { categoria: 'Loja (produtos)', itens: produtos, vendas: conta(produtos), receita: soma(produtos, 'receita') },
  { categoria: 'Outros servicos', itens: outrosServ, vendas: conta(outrosServ), receita: soma(outrosServ, 'receita') }
].filter(c => c.vendas > 0 || c.receita > 0);

/* Fechamento financeiro do professor. A aula tem valor fixo e sai apurada por
   nome. O exame paga um terco do que foi cobrado, mas a EVO registra a VENDA do
   exame, nao quem aplicou — entao a fatia sai como bolo a ratear, nao por
   professor. O personal fica de fora do calculo por enquanto, a pedido. */
const totalAulasMes = folha.reduce((t, f) => t + num(f.aulas), 0);
const receitaExamesMes = soma(exames, 'receita');
const parteExames = arred(receitaExamesMes * FATIA_EXAME, 2);
const folhaResumo = {
  valor_por_aula: VALOR_AULA,
  aulas_no_mes: totalAulasMes,
  custo_das_aulas: arred(totalAulasMes * VALOR_AULA, 2),
  exames_no_mes: conta(exames),
  receita_dos_exames: receitaExamesMes,
  parte_dos_professores_nos_exames: parteExames,
  exame_sem_professor: conta(exames) > 0,
  particulares_avulsas_no_mes: conta(particulares),
  receita_das_particulares: soma(particulares, 'receita'),
  receita_personal_recorrente: soma(personalRec, 'receita'),
  particular_fora_do_calculo: true,
  total_apurado: arred(totalAulasMes * VALOR_AULA + parteExames, 2)
};

const receitaPlanosVendidos = arred(planosVendidos.reduce((t, x) => t + num(x.receita), 0), 2);
const receitaAvulsa = arred(categorias.reduce((t, c) => t + num(c.receita), 0), 2);
const caixa = {
  planos_vendidos_no_mes: receitaPlanosVendidos,
  servicos_e_produtos: receitaAvulsa,
  total_movimentado: arred(receitaPlanosVendidos + receitaAvulsa, 2),
  recorrente_contratado: arred(mrr, 2),
  pct_fora_do_recorrente: (receitaPlanosVendidos + receitaAvulsa) > 0
    ? arred(receitaAvulsa / (receitaPlanosVendidos + receitaAvulsa) * 100, 1) : null
};

const avulsos = {
  exames_vendidos: conta(exames), receita_exames: soma(exames, 'receita'), detalhe_exames: exames,
  particulares_avulsas: conta(particulares), receita_particulares: soma(particulares, 'receita'),
  detalhe_particulares: particulares,
  alunos_personal_recorrente: personalRec.reduce((t, x) => t + x.alunos, 0),
  receita_personal_recorrente: soma(personalRec, 'receita'),
  aulas_avulsas: conta(avulsas), receita_avulsas: soma(avulsas, 'receita'),
  alugueis_de_kimono: conta(alugueis), receita_alugueis: soma(alugueis, 'receita'),
  experimentais_lancadas_como_servico: conta(experimentais_vendidas),
  categorias: categorias, caixa: caixa,
  professor_nao_identificado: true
};

/* Diagnostico do funil: a agenda dos leads foi mesmo lida? */
const funilDiag = {
  fonte: 'agenda individual (/v2/activities/member/sessions com dateStart/dateEnd), lida por lead e por aluno',
  pessoas_consultadas: Object.keys(leadsConsultados).length,
  sessoes_encontradas: experimentais.length,
  no_mes: expNoMes,
  na_semana: expNaSemana,
  complementares_no_mes: compMes.length,
  pontes_lead_aluno: ponte,
  fila_planejada: filaTotal,
  pessoas_que_ficaram_de_fora: filaCortada,
  fila_truncada: filaCortada > 0,
  sem_registro_de_experimental: experimentais.length === 0
};

const ultima = {};
for (const e of freq) { const id = e.idMember; if (!id) continue; const d = dia(e.date); if (!d) continue; if (!ultima[id] || d > ultima[id]) ultima[id] = d; }
const idadeDe = (n) => { const d = dia(n); if (!d) return null; return Math.floor((hoje - new Date(d)) / 31557600000); };
const risco = []; let criancas = 0, semIdade = 0;
for (const m of ativos) {
  const anos = idadeDe(m.birthDate);
  if (anos === null) { semIdade++; continue; }
  if (anos < 12) { criancas++; continue; }
  const u = ultima[m.idMember] || null;
  const d = u ? Math.floor((hoje - new Date(u)) / 86400000) : 60;
  if (d >= 14) risco.push({ aluno: nomeDe(m.idMember), dias_sem_treinar: d, ultima_presenca: u || 'sem registro em 60 dias' });
}
risco.sort((a, b) => b.dias_sem_treinar - a.dias_sem_treinar);
const adultos = alunos - criancas - semIdade;
/* 06/10/2026: no fechamento do mes as 'entradas' cobrem o MES, nao a semana — o
   e-mail de 01/10 mostrou 1.250 "check-ins da semana" e o de 05/10, 1.315. A semana
   agora sai da janela de 60 dias (freq), que sempre a contem, filtrada pelas datas. */
const entradasSem = (ctx.escopo === 'semana' ? entradas : freq).filter(e => e && noPeriodo(e.date, iSem, fSem));
const treinaram = unicos(entradasSem.filter(e => e.idMember && idAtivo[e.idMember]).map(e => e.idMember)).length;

const horaMap = {};
for (const s of sessoesSem) { const h = s.startTime || null; if (!h) continue; if (!horaMap[h]) horaMap[h] = { horario: h, aulas: 0, capacidade: 0, ocupacao: 0 }; horaMap[h].aulas += 1; horaMap[h].capacidade += num(s.capacity); horaMap[h].ocupacao += num(s.ocupation); }
const ocupacao = Object.keys(horaMap).map(k => { const o = horaMap[k]; return { horario: o.horario, aulas: o.aulas, capacidade: o.capacidade, presentes: o.ocupacao, taxa: o.capacidade > 0 ? arred(o.ocupacao / o.capacidade * 100, 1) : null }; }).sort((a, b) => a.horario.localeCompare(b.horario));

/* Mesma correcao do mes: quem entrou e saiu na propria semana continua sendo
   matricula da semana. O filtro por idAtivo escondia esses casos. */
const naSem = (v) => noPeriodo(v.saleDate, iSem, fSem) && porId[v.idMember];
const novosSem = unicos(Object.keys(todosPorId).map(k => todosPorId[k])
  .filter(m => m.idMember && noPeriodo(m.registerDate, iSem, fSem) && ehMatriculado(m.idMember, iSem, fSem)).map(m => m.idMember));
const ehNovoDaSem = {};
for (const id of novosSem) ehNovoDaSem[id] = 1;
const semana = { de: iSem, ate: fSem,
  novos: novosSem.length,
  retornos: 0,
  vendas_avulsas_de_ativos: unicos(vendasBalcao.filter(v => naSem(v) && idAtivo[v.idMember] && !ehNovoDaSem[v.idMember]).map(v => v.idMember)).length,
  cancelamentos: unicos(cancels.filter(c => noPeriodo(c.cancelDate, iSem, fSem)).map(c => c.idMember)).length,
  leads: prospects.filter(p => noPeriodo(p.registerDate, iSem, fSem)).length,
  experimentais_agendadas: expNaSemana.agendadas, experimentais_realizadas: expNaSemana.realizadas,
  experimentais_faltas: expNaSemana.faltas, experimentais_matriculas: expNaSemana.matriculas,
  aulas_dadas: sessoesSem.length,
  checkins: entradasSem.filter(e => e.idMember).length, alunos_que_treinaram: treinaram,
  pct_base_treinou: alunos > 0 ? arred(treinaram / alunos * 100, 1) : null,
  /* As turmas KIDS e BABY nao passam catraca: as criancas nao usam o app. O
     percentual acima e, na pratica, sobre a base adulta — o de baixo e o honesto. */
  pct_base_adulta_treinou: adultos > 0 ? arred(treinaram / adultos * 100, 1) : null,
  catraca_nao_cobre_criancas: true,
  alunos_em_risco: risco.length, base_adulta: adultos,
  pct_adultos_em_risco: adultos > 0 ? arred(risco.length / adultos * 100, 1) : null,
  criancas_fora_do_radar: criancas, sem_data_nascimento: semIdade };

const mes = { mes: ctx.chaveMes, alunosInicio, alunos, contratos, novos, retornos, cancelamentos, inadimplentes, valorInad: arred(valorInad, 2), mrr: arred(mrr, 2), leads: leadsMes, agendadas, realizadas, matriculas: novos, matriculasExp: expNoMes.matriculas, pessoasExp: expNoMes.pessoas, invMkt: 0, professores, professoresSemana, planos, servicos, produtos, receitaServicos: arred(receitaServicos, 2), receitaProdutos: arred(receitaProdutos, 2) };

const bloco = { cadastrados_ativos: cadastrados.length, alunos_ativos: alunos, contratos_ativos: contratos,
  congelados: congelados, lista_congelados: listaCongelados,
  vip_incluidos_na_base: emCortesia,
  em_cortesia: emCortesia, cadastro_sem_contrato_vigente: semContrato,
  renovacoes_sobrepostas: renovacoesSobrepostas,
  contratos_por_aluno: alunos > 0 ? arred(contratos / alunos, 2) : null,
  alunos_com_mais_de_um_contrato: multiplos.length,
  /* Contrato vigente que a EVO deixou sem valor. Nao tira ninguem da base;
     so avisa que a receita por plano esta subestimada nesses casos. */
  contratos_sem_valor_registrado: contratosSemValor,
  /* Saida silenciosa: cadastro ativo cujo contrato venceu sem ninguem cancelar.
     Nao entra no churn da EVO, mas e perda de aluno do mesmo jeito. */
  saidas_sem_cancelamento: semContrato,
  novos_do_mes_que_seguem_ativos: novosQueFicaram,
  /* "retornos" ainda soma renovacao de plano recorrente: a EVO registra a
     cobranca mensal como venda nao-recorrente e nao expoe campo que separe
     as duas. Por isso ele fica fora da conta da base do inicio do mes. */
  /* Retorno de ex-aluno nao e medido: a EVO nao entrega o historico de
     contratos vencidos, entao nao da para saber quem ficou sem contrato e
     voltou. O campo retornos vale zero de proposito, e por isso as entradas
     do Placar (so cadastro novo) ficam abaixo das do painel da EVO. */
  retornos_nao_medido: true,
  vendas_avulsas_de_ativos_no_mes: vendasAvulsasDeAtivos,
  base_inicio_por_formula: true,
  /* Dia em que a base foi fotografada. No fechamento e o ultimo dia do mes
     apurado, nao o dia em que o relatorio rodou. */
  base_fotografada_em: refBase,
  /* Contratos cuja duracao destoa da mediana do proprio plano. E a marca
     que o congelamento deixa, mas a API nao confirma suspensao, entao
     ninguem sai da base por isso: e lista de conferencia. */
  contratos_esticados: esticados.length,
  criterio: 'cadastro ativo + contrato vigente, fora VIP — mesma regra do Dashboard da EVO' };

const detalhe = { contratos_esticados: esticados.slice(0, 40), motivos_cancelamento: motivos, coortes_cancelamento: coortes, aging_inadimplencia: aging, canais_lead: canais, ocupacao_por_horario: ocupacao, alunos_em_risco: risco.slice(0, 40), multiplos_contratos: multiplos.slice(0, 25), servicos_avulsos: servicos, produtos_vendidos: produtos, aulas_por_professor: aulasPorProfessor, aulas_por_modalidade: aulasPorModalidade, funil_diagnostico: funilDiag, vendedores: vendedores, churn: churn, planos_vendidos: planosVendidos, caixa_do_mes: caixa, experimentais_do_mes: expMes.slice(0, 40), complementares_do_mes: compMes.slice(0, 25), folha_do_mes: folha, folha_resumo: folhaResumo, sessoes_no_mes: sessoesMes.length, avulsos_do_mes: avulsos, nomes_de_aula_na_semana: unicos(sessoesSem.map(s => s.name)) };

const pgs = respostas.filter(r => r && r.rotulo && r.rotulo.indexOf('contratos:') === 0);
const pag0 = pgs.filter(r => r.rotulo === 'contratos:0')[0];
const vaziasNoFim = pgs.filter(r => Array.isArray(r.itens) && r.itens.length === 0).length;
detalhe.matriculas_sem_experimental = matriculasSemExperimental;
/* Quem conta como novo no mes — o Complementar cruza com a experimental dos 45 dias. */
detalhe.novos_do_mes = unicos(idsNovos).map(id => { const m = todosPorId[id] || {};
  return { idMember: id, aluno: nomeDe(id), entrou: dia(m.registerDate), canal: (m.mktChannel || '').trim() || null }; });
detalhe.coortes_entrada = coortesEntrada;
detalhe.coorte_resumo = coorteResumo;

const diagnostico = { respostas_ok: respostas.filter(r => r.ok).length, respostas_erro: respostas.filter(r => !r.ok).map(r => r.rotulo + ' -> ' + r.status),
  dias_de_grade_pedidos: respostas.filter(r => r && r.rotulo && String(r.rotulo).indexOf('sessoes:') === 0).length,
  dias_de_grade_lidos: respostas.filter(r => r && r.ok && r.rotulo && String(r.rotulo).indexOf('sessoes:') === 0).length,
  contratos_lidos: contratosBrutos.length, contratos_vigentes: vigentes.length,
  leads_casados_com_aluno: leadsCasadosPorContato, cancelamentos_12_meses: cancelAno.length,
  chegou_ao_fim_da_lista: vaziasNoFim > 0,
  sobra_no_inicio_da_janela: !!(pag0 && Array.isArray(pag0.itens) && pag0.itens.filter(c => dia(c.membershipEnd) > hojeYMD).length === 0) };

return [{ json: { ok: true, escopo: ctx.escopo, geradoEm: new Date().toISOString(), mes, semana, base: bloco, detalhe, diagnostico } }];
