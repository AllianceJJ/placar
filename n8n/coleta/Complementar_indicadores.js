/* Complementar indicadores — 16/09/2026.
   Roda DEPOIS de "Calcular indicadores" e só acrescenta campos; nunca derruba a coleta.
   1) detalhe.pipeline: leads abertos (sem idMember e sem conversão) dos últimos 60 dias,
      por etapa do CRM (currentStep), com dias em aberto, experimentais feitas e próxima aula.
   2) detalhe.leads_duplicados: cadastros com o mesmo telefone E o mesmo primeiro nome (irmãos dividem telefone e não são duplicata); mes.leads_unicos.
   3) detalhe.funil_45 e mes.matriculasExp: a experimental do aluno novo é procurada nos
      45 dias ANTERIORES à conversão (agenda de lead e de aluno), não só dentro do mês —
      venda na virada do mês deixa de sair como "entrou direto".
   06/10/2026 — conferido contra Gerencial > Oportunidades da EVO (setembro: 38 cadastradas,
   13 convertidas; 17 convertidas no mês pela aba "Oportunidades convertidas"):
   - lead aberto cujo telefone/e-mail já é de um aluno que converteu DEPOIS do cadastro do
     lead é oportunidade em dobro: sai do pipeline e vai para leads_duplicados/leads_ja_alunos;
   - "NÃO DEU CERTO" é lead perdido, não pipeline aberto;
   - mes.leads_evo conta como a tela: oportunidades CADASTRADAS no mês (abertas + convertidas).
     Antes somava todo convertido do mês, inclusive quem tinha oportunidade de meses antes;
   - a origem (canal) de quem converteu vem do lead guardado na tabela "Leads vistos" — a EVO
     tira o lead de /v1/prospects na conversão e o cadastro do aluno vem sem canal;
   - matrícula da experimental só conta quem entrou como novo (contrato ou plano comprado):
     conversão sem venda (ex.: irmãos Ruaro, 30/09) fica numa lista à parte. */
/* 17/09/2026: o nó anterior agora é a leitura da Data Table "Aulas por aluno"; o cálculo vem pelo nome */
/* 06/10/2026: a entrada passou a ser "Ler leads vistos"; as aulas por aluno vêm pelo nome */
const out = $('Calcular indicadores').first().json;
let tabela = [];
try { tabela = $('Ler aulas por aluno').all().map(i => i.json).filter(r => r && r.idMember); } catch (e) { tabela = []; }
let leadsVistos = [];
try { leadsVistos = $('Ler leads vistos').all().map(i => i.json).filter(r => r && Number(r.idProspect) > 0); } catch (e) { leadsVistos = []; }
try {
  const hoje = new Date(out.geradoEm || Date.now());
  const D = s => s ? new Date(String(s).slice(0,10) + 'T12:00:00') : null;
  const dias = (a,b) => Math.round((b - a) / 86400000);
  const dia = s => s ? String(s).slice(0, 10) : '';
  const motor = $('Motor EVO').all().map(i => i.json);
  let fase2 = [];
  try { fase2 = $('Motor EVO (leads)').all().map(i => i.json); } catch (e) { fase2 = []; }
  const respostas = motor.concat(fase2);
  const lista = (pre) => respostas.filter(x => String(x.rotulo || '').indexOf(pre + ':') === 0).flatMap(x => x.itens || []);
  const unicoPor = (arr, campo) => { const v = {}, o = []; for (const x of arr) { const k = x && x[campo]; if (!k || v[k]) continue; v[k] = 1; o.push(x); } return o; };
  const pros = unicoPor(lista('prospects'), 'idProspect');
  const mem = unicoPor(lista('membros'), 'idMember');
  const ag = {};
  for (const a of fase2) {
    const m = /^agenda([PM]):(\d+)/.exec(a.rotulo || ''); if (!m) continue;
    ag[m[1] + m[2]] = (a.itens || []).filter(s => s && !/aula\s*[23]/i.test(s.activitieName || ''));
  }
  const feita = s => s.isFinalized !== false && s.presenca && !s.falta;
  const fone = p => String(p.cellphone || '').replace(/\D/g, '').replace(/^55/, '');
  const nome = p => [p.firstName, p.lastName].filter(Boolean).join(' ').trim().toUpperCase();
  const nomeM = m => [m.firstName, m.lastName].filter(Boolean).join(' ').trim().toUpperCase();
  const mes = out.mes && out.mes.mes;
  const noMes = s => !!s && String(s).slice(0,7) === mes;

  /* Chaves de contato para casar lead e aluno: celular (10 últimos dígitos) e e-mail.
     O contato do aluno mora em contacts[]; o do lead, nos campos soltos. */
  const k10 = v => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
  const mail = v => { const e = String(v || '').trim().toLowerCase(); return e.indexOf('@') > 0 ? e : ''; };
  const limpa = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const chavesLead = p => { const f = [];
    for (const c of [p.cellphone, p.phone, p.telephone, p.mobilePhone, p.fone]) { const k = k10(c); if (k) f.push('f:' + k); }
    const e = mail(p.email); if (e) f.push('e:' + e);
    const n = limpa(p.nome || nome(p)); if (n && n.indexOf(' ') > 0) f.push('n:' + n);
    return f; };
  const chavesMembro = m => { const f = [];
    for (const c of (Array.isArray(m.contacts) ? m.contacts : [])) { const d = c && c.description; if (!d) continue;
      if (String(d).indexOf('@') > 0) { const e = mail(d); if (e) f.push('e:' + e); } else { const k = k10(d); if (k) f.push('f:' + k); } }
    const n = limpa(nomeM(m)); if (n && n.indexOf(' ') > 0) f.push('n:' + n);
    return f; };
  const convDe = m => dia(m.conversionDate || m.registerDate);
  const membrosPorChave = {};
  for (const m of mem) for (const k of chavesMembro(m)) (membrosPorChave[k] = membrosPorChave[k] || []).push(m);
  /* Aluno que converteu a partir do cadastro deste lead (ou depois dele): a oportunidade
     aberta é a cópia que ficou para trás. Ex-aluno antigo com o mesmo telefone não conta —
     é retorno legítimo e continua no pipeline. */
  /* Família divide telefone e e-mail (Isabella e Patrícia Antonini, José e Maria Fernanda
     Ruaro): o contato só casa lead e aluno quando o primeiro nome também bate. */
  const primeiro = s => limpa(s).split(' ')[0] || '';
  const alunoDoLead = (p) => {
    const cad = dia(p.registerDate || p.cadastro); if (!cad) return null;
    const pn = primeiro(p.nome || nome(p));
    for (const k of chavesLead(p)) for (const m of (membrosPorChave[k] || [])) {
      if (primeiro(nomeM(m)) !== pn) continue;
      const cv = convDe(m); if (cv && dias(D(cad), D(cv)) >= -1) return m;
    }
    return null;
  };

  /* Leads conhecidos: os abertos de agora mais os que a tabela "Leads vistos" guardou
     nas coletas anteriores — inclusive quem já converteu e sumiu de /v1/prospects. */
  const conhecidos = {};
  for (const r of leadsVistos) conhecidos[r.idProspect] = { idProspect: Number(r.idProspect), cadastro: dia(r.cadastro), canal: String(r.canal || '').trim(), nome: r.nome || '', fone: r.fone || '', email: r.email || '' };
  for (const p of pros) conhecidos[p.idProspect] = { idProspect: p.idProspect, cadastro: dia(p.registerDate), canal: String(p.mktChannel || '').trim(), nome: nome(p), fone: k10(p.cellphone), email: mail(p.email), cellphone: p.cellphone };
  const leadsPorChave = {};
  for (const id of Object.keys(conhecidos)) { const l = conhecidos[id]; for (const k of chavesLead(l)) (leadsPorChave[k] = leadsPorChave[k] || []).push(l); }
  /* A oportunidade que virou este aluno: o lead mais recente com o mesmo contato,
     cadastrado até o dia seguinte à conversão. Sem lead conhecido = entrou direto. */
  const leadDoAluno = (m) => {
    const cv = convDe(m), mn = primeiro(nomeM(m)); let melhor = null;
    for (const k of chavesMembro(m)) for (const l of (leadsPorChave[k] || [])) {
      if (primeiro(l.nome) !== mn) continue;
      if (!l.cadastro || !cv || dias(D(l.cadastro), D(cv)) < -1) continue;
      if (!melhor || l.cadastro > melhor.cadastro) melhor = l;
    }
    return melhor;
  };

  /* 1) pipeline */
  const perdido = p => /N[AÃ]O DEU CERTO/i.test(String(p.currentStep || ''));
  const recentes = pros.filter(p => !p.idMember && !p.conversionDate && D(p.registerDate) && dias(D(p.registerDate), hoje) <= 60);
  const jaAlunos = [];
  for (const p of pros) { const m = alunoDoLead(p); if (m) jaAlunos.push({ p, m }); }
  const ehJaAluno = {}; for (const x of jaAlunos) ehJaAluno[x.p.idProspect] = 1;
  const abertos = recentes.filter(p => !ehJaAluno[p.idProspect] && !perdido(p));
  const perdidos = recentes.filter(p => !ehJaAluno[p.idProspect] && perdido(p));
  const etapas = {};
  const listaPipe = abertos.map(p => {
    const sess = ag['P' + p.idProspect] || [];
    const fut = sess.filter(s => s.isFinalized === false);
    const et = (p.currentStep || '').trim() || 'Sem etapa';
    etapas[et] = (etapas[et] || 0) + 1;
    return { idProspect: p.idProspect, nome: nome(p), cadastro: String(p.registerDate || '').slice(0,10),
      dias: dias(D(p.registerDate), hoje), etapa: et, canal: p.mktChannel || '',
      experimentais_feitas: sess.filter(feita).length,
      proxima_aula: fut.length ? String(fut[0].date || '').slice(0,10) : null };
  }).sort((a,b) => b.dias - a.dias);

  /* 2) duplicados por telefone + lead aberto de quem já é aluno */
  const porFone = {};
  for (const p of pros) { const f = fone(p); if (f.length < 8) continue; const k = f + '|' + String(p.firstName || '').trim().toUpperCase(); (porFone[k] = porFone[k] || []).push(p); }
  const duplicados = Object.values(porFone).filter(l => l.length > 1)
    .map(l => ({ telefone_final: fone(l[0]).slice(-4), leads: l.map(p => ({ idProspect: p.idProspect, nome: nome(p), cadastro: String(p.registerDate || '').slice(0,10) })) }));
  const leadsJaAlunos = jaAlunos.map(({ p, m }) => ({ idProspect: p.idProspect, lead: nome(p), cadastro: dia(p.registerDate),
    etapa: (p.currentStep || '').trim() || 'Sem etapa', idMember: m.idMember, aluno: nomeM(m), convertido: convDe(m) }));
  for (const x of leadsJaAlunos) duplicados.push({ telefone_final: (fone(pros.find(p => p.idProspect === x.idProspect) || {}) || '').slice(-4), tipo: 'lead aberto de quem já é aluno',
    leads: [{ idProspect: x.idProspect, nome: x.lead, cadastro: x.cadastro }, { idMember: x.idMember, nome: x.aluno + ' (já é aluno)', cadastro: x.convertido }] });
  const leadsMes = pros.filter(p => noMes(p.registerDate));
  const unicos = new Set(leadsMes.map(p => fone(p).length >= 8 ? fone(p) + '|' + String(p.firstName || '').trim().toUpperCase() : 'id' + p.idProspect)).size;

  /* 3) experimental nos 45 dias anteriores à conversão.
     A EVO tira o lead de /v1/prospects quando ele converte, então a base aqui é o ALUNO:
     /v1/members traz conversionDate e a agenda do aluno herda as sessões do lead. */
  const comExp = [], semExp = [], convertidosNoMes = [];
  const vistos = new Set();
  for (const m of mem) {
    const convS = m.conversionDate || m.registerDate;
    if (!noMes(convS) || vistos.has(m.idMember)) continue;
    vistos.add(m.idMember);
    convertidosNoMes.push(m);
    const conv = D(convS);
    const sess = (ag['M' + m.idMember] || []).filter(s => { const d = D(s.date); return d && feita(s) && dias(d, conv) >= -1 && dias(d, conv) <= 45; });
    (sess.length ? comExp : semExp).push({ idMember: m.idMember, nome: nomeM(m), conversao: String(convS).slice(0,10),
      experimental: sess.length ? String(sess[0].date || '').slice(0,10) : null, professor: sess.length ? (sess[0].instructor || '') : '' });
  }
  /* Só é matrícula quem o Calcular contou como novo (contrato de pé ou plano comprado). */
  const novosLista = Array.isArray(out.detalhe && out.detalhe.novos_do_mes) ? out.detalhe.novos_do_mes : null;
  const ehNovo = {}; if (novosLista) for (const n of novosLista) ehNovo[n.idMember] = n;
  const comV = novosLista ? comExp.filter(x => ehNovo[x.idMember]) : comExp;
  const semV = novosLista ? semExp.filter(x => ehNovo[x.idMember]) : semExp;
  const semContrato = novosLista ? comExp.concat(semExp).filter(x => !ehNovo[x.idMember]) : [];
  if (novosLista) {
    const ja = new Set(comV.concat(semV).map(x => x.idMember));
    for (const n of novosLista) if (!ja.has(n.idMember)) semV.push({ idMember: n.idMember, nome: String(n.aluno || '').toUpperCase(), conversao: n.entrou, experimental: null, professor: '' });
  }

  /* 4) oportunidades do mês como Gerencial > Oportunidades conta: cadastradas no mês,
     abertas ou convertidas. O convertido entra pela data de cadastro do lead dele. */
  const SEM_REGISTRO = 'Sem registro do lead';
  const coorte = [];
  for (const m of convertidosNoMes) {
    const l = leadDoAluno(m);
    const cad = l ? l.cadastro : convDe(m);
    if (!noMes(cad)) continue;
    coorte.push({ idMember: m.idMember, nome: nomeM(m), cadastro_lead: cad, lead_conhecido: !!l,
      canal: l ? (l.canal || 'Nao informado') : (String(m.mktChannel || '').trim() || SEM_REGISTRO) });
  }
  const leadsEvo = (+out.mes.leads || 0) + coorte.length;
  /* A mesma régua na semana: abertos cadastrados na semana + convertidos cujo lead é da semana. */
  if (out.semana && out.semana.de && out.semana.ate) {
    const naSemana = s => !!s && s >= out.semana.de && s <= out.semana.ate;
    let convSem = 0;
    for (const m of mem) { const cv = convDe(m); if (!naSemana(cv)) continue; const l = leadDoAluno(m); if (naSemana(l ? l.cadastro : cv)) convSem++; }
    out.semana.leads_abertos = out.semana.leads;
    out.semana.leads_convertidos = convSem;
    out.semana.leads_evo = (+out.semana.leads || 0) + convSem;
    /* semana.leads é o número do WhatsApp/e-mail ("Leads na semana"); o painel não usa. */
    out.semana.leads = out.semana.leads_evo;
  }
  /* Origem dos leads do mês: abertos + convertidos. Quem converteu antes de a coleta ver o
     lead (matrícula no mesmo dia, de balcão) fica como "Sem registro do lead" — não é campo
     vazio no EVO, é informação que a API não devolve depois da conversão. */
  const canais = {};
  for (const p of leadsMes) { const c = String(p.mktChannel || '').trim() || 'Nao informado'; canais[c] = (canais[c] || 0) + 1; }
  for (const x of coorte) { const c = x.canal || 'Nao informado'; canais[c] = (canais[c] || 0) + 1; }
  const canalDe = (idMember) => { const m = mem.find(y => y.idMember === idMember); if (!m) return null; const l = leadDoAluno(m); if (l) return l.canal || null; return String(m.mktChannel || '').trim() || SEM_REGISTRO; };

  out.detalhe = out.detalhe || {};
  out.detalhe.pipeline = { referencia: hoje.toISOString().slice(0,10), janela_dias: 60, abertos: abertos.length, por_etapa: etapas,
    perdidos: perdidos.length, ja_alunos: leadsJaAlunos.filter(x => recentes.some(p => p.idProspect === x.idProspect)).length, lista: listaPipe };
  out.detalhe.leads_duplicados = duplicados;
  out.detalhe.leads_ja_alunos = leadsJaAlunos;
  out.detalhe.funil_45 = { regra: 'experimental realizada nos 45 dias anteriores à conversão, na agenda de lead e de aluno; só conta quem entrou como novo (contrato ou plano comprado)',
    conversoes_no_mes: comV.length + semV.length, fonte: '/v1/members (conversionDate) + agenda do aluno',
    com_experimental: comV, sem_experimental: semV, convertidos_sem_contrato: semContrato };
  out.detalhe.oportunidades_do_mes = { regra: 'como Gerencial > Oportunidades: cadastradas no mês, abertas + convertidas; convertido entra pela data de cadastro do lead',
    abertas: +out.mes.leads || 0, convertidas: coorte.length, convertidas_no_mes_qualquer_cadastro: convertidosNoMes.length,
    sem_lead_conhecido: coorte.filter(x => !x.lead_conhecido).length, convertidas_lista: coorte };
  out.detalhe.canais_lead = canais;
  if (out.mes) {
    out.mes.leads_unicos = unicos;
    out.mes.leads_abertos_no_mes = out.mes.leads;
    out.mes.leads_evo = leadsEvo;
    out.mes.leads_convertidos = coorte.length;
    out.mes.matriculasExp_no_mes = out.mes.matriculasExp;
    if (novosLista) out.mes.matriculasExp = comV.length;
    else if (comV.length > (+out.mes.matriculasExp || 0)) out.mes.matriculasExp = comV.length;
  }
  if (novosLista) {
    out.detalhe.matriculas_sem_experimental = semV.map(x => { const n = ehNovo[x.idMember] || {};
      return { aluno: n.aluno || x.nome, entrou: n.entrou || x.conversao, canal: canalDe(x.idMember) }; })
      .sort((a, b) => String(a.entrou).localeCompare(String(b.entrou)));
  } else if (Array.isArray(out.detalhe.matriculas_sem_experimental)) {
    const nomes = new Set(comV.map(x => x.nome));
    out.detalhe.matriculas_sem_experimental = out.detalhe.matriculas_sem_experimental.filter(x => !nomes.has(String(x.aluno || '').trim().toUpperCase()));
  }
} catch (e) {
  out.detalhe = out.detalhe || {};
  out.detalhe.complemento_erro = String(e && e.message || e);
}

/* 4) Listas de ação a partir da Data Table "Aulas por aluno" (17/09/2026):
   risco (14+ dias sem treinar), aptos ao exame, infantil por faixa, e o no-show do mês
   já descontando aula futura (para o histórico gravar o número certo). */
try {
  const hoje = new Date(out.geradoEm || Date.now());
  const D = s => s ? new Date(String(s).slice(0,10) + 'T12:00:00') : null;
  const dias = (a,b) => Math.round((b - a) / 86400000);
  let motor = $('Motor EVO').all().map(i => i.json);
  try { motor = motor.concat($('Motor EVO (leads)').all().map(i => i.json)); } catch (e) { /* so a fase 1 */ }
  const mem = motor.filter(x => /^membros/.test(x.rotulo || '')).flatMap(x => x.itens || []);
  const porId = {}; for (const m of mem) { if (m.idMember && !porId[m.idMember]) porId[m.idMember] = m; }
  const nomeM = m => [m.firstName, m.lastName].filter(Boolean).join(' ').trim().toUpperCase();
  const ativo = m => m && String(m.membershipStatus || '').toLowerCase() !== 'suspended' && !/inactive|inativo/i.test(String(m.status || ''));
  /* pegadinha conhecida: "Branca (Juvenil/Adulto)" tem barra DENTRO do parêntese — a categoria sai antes do teste */
  const nomeFaixa = s => String(s || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*-\s*grau\s*\d+.*$/i, '').trim();
  const ehKid = r => /\(infantil\)/i.test(String(r.faixaEvo || '')) || /^(cinza|amarela|laranja|verde)/i.test(nomeFaixa(r.faixaEvo)) || nomeFaixa(r.faixaEvo).includes('/') || /^(cinza|amarela|laranja|verde)$/i.test(String(r.faixa || ''));
  /* quem dá aula não é aluno em risco */
  const profNomes = [].concat(out.detalhe.folha_do_mes || [], out.detalhe.aulas_por_professor || []).map(p => String(p.professor || '').trim().toUpperCase()).filter(Boolean);
  const ehProfessor = nome => profNomes.some(p => p && (nome === p || nome.startsWith(p + ' ') || (p.split(' ').length >= 2 && nome.startsWith(p))));
  const linhas = tabela.map(r => ({ r, m: porId[r.idMember] })).filter(x => x.m && ativo(x.m) && !ehProfessor(nomeM(x.m)));
  /* risco */
  const risco = [];
  for (const { r, m } of linhas) {
    if (ehKid(r)) continue;
    const ua = D(r.ultimaAula); const dsem = ua ? dias(ua, hoje) : null;
    const reg = D(m.registerDate); const casa = reg ? dias(reg, hoje) : null;
    if (dsem == null) { if ((+r.aulas || 0) === 0 && casa != null && casa >= 14) risco.push({ idMember: r.idMember, nome: nomeM(m), dias_sem_treinar: null, nunca_treinou: true, sem_faixa_na_ficha: r.faixaPresumida !== false, dias_de_casa: casa, faixa: r.faixaPresumida !== false ? '' : (r.faixaEvo || r.faixa || ''), aulas: +r.aulas || 0, ultima_aula: null }); continue; }
    if (dsem >= 14) risco.push({ idMember: r.idMember, nome: nomeM(m), dias_sem_treinar: dsem, nunca_treinou: false, dias_de_casa: casa, faixa: r.faixaEvo || r.faixa || '', aulas: +r.aulas || 0, ultima_aula: String(r.ultimaAula).slice(0,10) });
  }
  risco.sort((a,b) => (b.dias_sem_treinar == null ? 9999 : b.dias_sem_treinar) - (a.dias_sem_treinar == null ? 9999 : a.dias_sem_treinar));
  const faixasRisco = { '14 a 29 dias': 0, '30 a 59 dias': 0, '60 dias ou mais': 0, 'nunca treinou (faixa conhecida)': 0, 'sem nenhum registro': 0 };
  for (const x of risco) { if (x.nunca_treinou) faixasRisco[x.sem_faixa_na_ficha ? 'sem nenhum registro' : 'nunca treinou (faixa conhecida)']++; else if (x.dias_sem_treinar >= 60) faixasRisco['60 dias ou mais']++; else if (x.dias_sem_treinar >= 30) faixasRisco['30 a 59 dias']++; else faixasRisco['14 a 29 dias']++; }
  const comData = risco.filter(x => !x.nunca_treinou), semRegistro = risco.filter(x => x.nunca_treinou && x.sem_faixa_na_ficha), nuncaAdulto = risco.filter(x => x.nunca_treinou && !x.sem_faixa_na_ficha);
  out.detalhe.alunos_em_risco = { referencia: hoje.toISOString().slice(0,10), regra: 'aluno ativo com faixa adulta na ficha e sem check-in há 14+ dias; quem nunca teve check-in nem faixa na ficha fica numa lista à parte, porque pode ser criança (infantil não passa na catraca)', ativos_avaliados: linhas.filter(x => !ehKid(x.r)).length, total: comData.length + nuncaAdulto.length, sem_registro: semRegistro.length, por_faixa: faixasRisco, lista: comData.concat(nuncaAdulto).slice(0, 80), lista_sem_registro: semRegistro.slice(0, 80) };
  /* aptos ao exame */
  const aptos = linhas.filter(({ r }) => /^apto ao exame/i.test(String(r.situacao || '')) && r.faixaPresumida === false).map(({ r, m }) => ({ idMember: r.idMember, nome: nomeM(m), faixa: r.faixaEvo || r.faixa || '', aulas: +r.aulas || 0, situacao: r.situacao, ultima_aula: r.ultimaAula ? String(r.ultimaAula).slice(0,10) : null, dias_sem_treinar: r.ultimaAula ? dias(D(r.ultimaAula), hoje) : null })).sort((a,b) => b.aulas - a.aulas);
  const rumo = linhas.filter(({ r }) => /^rumo ao exame/i.test(String(r.situacao || '')) && r.faixaPresumida === false && (+r.faltamAulas || 0) <= 15).map(({ r, m }) => ({ idMember: r.idMember, nome: nomeM(m), faixa: r.faixaEvo || r.faixa || '', aulas: +r.aulas || 0, faltam: +r.faltamAulas || 0 })).sort((a,b) => a.faltam - b.faltam);
  out.detalhe.aptos_ao_exame = { total: aptos.length, lista: aptos, chegando: rumo.slice(0, 20), valor_exame: 205 };
  /* infantil */
  const kids = linhas.filter(({ r }) => ehKid(r));
  const porFaixa = {}; for (const { r } of kids) { const k = String(r.faixaEvo || r.faixa || 'sem faixa').replace(/\s*-\s*grau\s*\d+/i, '').trim(); porFaixa[k] = (porFaixa[k] || 0) + 1; }
  out.detalhe.professores_excluidos_do_risco = profNomes;
  const novosKids = kids.filter(({ m }) => m.registerDate && dias(D(m.registerDate), hoje) <= 90).length;
  out.detalhe.infantil = { regra: 'aluno ativo com faixa infantil na ficha da EVO (cinza, amarela, laranja, verde, duas cores ou "(Infantil)")', ativos: kids.length, por_faixa: porFaixa, entraram_90_dias: novosKids, presumidos: linhas.filter(({ r }) => r.faixaPresumida !== false).length, lista: kids.map(({ r, m }) => ({ idMember: r.idMember, nome: nomeM(m), faixa: r.faixaEvo || r.faixa || '', entrou: String(m.registerDate || '').slice(0,10) })) };
  /* no-show do mês sem aula futura (para o histórico) */
  const ex = (out.detalhe.experimentais_do_mes || []).filter(x => x && !x.complementar);
  if (ex.length && out.mes) {
    const fut = ex.filter(x => x.finalizada === false && !x.falta).length, falt = ex.filter(x => x.falta).length;
    const dadas = Math.max(0, (+out.mes.agendadas || 0) - fut);
    out.mes.agendadas_futuras = fut; out.mes.faltas = falt;
    out.mes.noShow = dadas > 0 ? Math.round(falt / dadas * 1000) / 10 : 0;
  }
} catch (e) {
  out.detalhe = out.detalhe || {};
  out.detalhe.complemento_erro_2 = String(e && e.message || e);
}

return [{ json: out }];