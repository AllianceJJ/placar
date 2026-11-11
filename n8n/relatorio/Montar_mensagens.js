const cfg = $('Configuração').first().json;
const d = $input.first().json;
const m = d.mes, s = d.semana, det = d.detalhe || {};
const escopo = d.resumo.escopo;
const nl = String.fromCharCode(10);

const N = (v) => (v === null || v === undefined || !isFinite(v)) ? '-' : new Intl.NumberFormat('pt-BR').format(Math.round(v));
const R$ = (v) => (v === null || v === undefined || !isFinite(v)) ? '-' : 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const P = (v) => (v === null || v === undefined || !isFinite(v)) ? '-' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + '%';
const br = (iso) => { const p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1]; };

/* Desde 17/09 a Coleta ("Complementar indicadores") devolve alunos_em_risco,
   aptos_ao_exame, infantil e pipeline como OBJETO { total, por_faixa, lista }.
   Antes era um array simples. Esta funcao aceita os dois formatos, para o
   relatorio nunca mais quebrar quando a Coleta mudar de forma. */
const lista = (v) => Array.isArray(v) ? v : (v && Array.isArray(v.lista) ? v.lista : []);
const total = (v, fallback) => (v && typeof v === 'object' && !Array.isArray(v) && isFinite(v.total)) ? v.total : (Array.isArray(v) ? v.length : fallback);

const inicio = m.alunosInicio || 0;
const churn = inicio > 0 ? m.cancelamentos / inicio * 100 : null;
const cresc = inicio > 0 ? (m.novos + m.retornos - m.cancelamentos) / inicio * 100 : null;
const ticket = m.alunos > 0 ? m.mrr / m.alunos : null;
const inadPct = m.mrr > 0 ? m.valorInad / m.mrr * 100 : null;

const risco = lista(det.alunos_em_risco);
/* 11/11/2026: o numero e o percentual vem da mesma conta (semana: adultos em risco sobre a
   base adulta). Antes o numero vinha da lista do detalhe (91 de 274 avaliados) e o
   percentual da semana (67 de 216), e a mensagem dizia "91 adultos (31,0%)". */
const riscoTotal = isFinite(s.alunos_em_risco) ? s.alunos_em_risco : total(det.alunos_em_risco, null);
const riscoFaixa = (det.alunos_em_risco && det.alunos_em_risco.por_faixa) || null;
const aptos = lista(det.aptos_ao_exame);
const aptosTotal = total(det.aptos_ao_exame, null);
const pipe = det.pipeline || {};

const titulo = escopo === 'mes'
  ? 'Fechamento de ' + m.mes
  : 'Semana de ' + br(s.de) + ' a ' + br(s.ate);

/* 11/11/2026: no fechamento, entradas, saidas e leads sao do mes inteiro. A "semana" da
   Coleta no dia 1o e a ultima semana completa antes (no fechamento de outubro, 19 a 25/10),
   entao a frequencia diz de que semana e. */
const doMes = escopo === 'mes';
const semanaTxt = 'semana de ' + br(s.de) + ' a ' + br(s.ate);
const zap = [
  '*Placar da Alliance SJC*',
  titulo,
  '',
  'Alunos ativos: *' + N(m.alunos) + '*',
  doMes ? 'Entradas no mês: ' + N(m.novos) + ' novos + ' + N(m.retornos) + ' retornos'
        : 'Entradas na semana: ' + N(s.novos) + ' novos + ' + N(s.retornos) + ' retornos',
  doMes ? 'Cancelamentos no mês: ' + N(m.cancelamentos) : 'Cancelamentos na semana: ' + N(s.cancelamentos),
  (doMes ? 'Leads no mês: ' + N(m.leads) : 'Leads na semana: ' + N(s.leads)) + (isFinite(pipe.abertos) ? ' | pipeline aberto: ' + N(pipe.abertos) : ''),
  '',
  'Treinaram' + (doMes ? ' (' + semanaTxt + ')' : '') + ': ' + N(s.alunos_que_treinaram) + ' de ' + N(m.alunos) + ' (' + P(s.pct_base_treinou) + ')',
  'Em risco: *' + N(riscoTotal) + '* adultos há 14+ dias sem treinar (' + P(s.pct_adultos_em_risco) + ' da base adulta)',
  aptosTotal !== null ? 'Prontos para o exame de faixa: ' + N(aptosTotal) : '',
  '',
  'No mês: churn ' + P(churn) + ' | crescimento ' + P(cresc),
  'Receita recorrente: ' + R$(m.mrr) + ' | ticket ' + R$(ticket),
  'Em atraso: ' + R$(m.valorInad) + ' (' + N(m.inadimplentes) + ' alunos)',
  '',
  cfg.urlPainel
].filter(l => l !== '' || true).join(nl).replace(/\n\n\n+/g, nl + nl);

const linha = (k, v) => '<tr><td style="padding:7px 14px 7px 0;color:#555">' + k + '</td><td style="padding:7px 0;font-weight:700;text-align:right">' + v + '</td></tr>';
const tab = (linhas) => '<table style="border-collapse:collapse;width:100%;max-width:460px;font-size:15px">' + linhas + '</table>';

const obj2linhas = (o, fmt) => Object.keys(o || {}).map(k => linha(k, (fmt || N)(o[k]))).join('');

/* Prioridade de contato: quem parou ha menos tempo tem mais chance de voltar,
   entao vem primeiro. Casos de anos sem treinar sao VIP/cortesia a limpar no EVO. */
const top = risco.slice()
  .filter(a => isFinite(a.dias_sem_treinar))
  .sort((a, b) => (a.dias_sem_treinar || 0) - (b.dias_sem_treinar || 0)).slice(0, 12)
  .map(a => '<li>' + (a.nome || a.aluno || '-') + (a.faixa ? ' <span style="color:#888">(' + a.faixa + ')</span>' : '') + ' &mdash; ' + N(a.dias_sem_treinar) + ' dias</li>').join('');

const exame = aptos.slice(0, 15)
  .map(a => '<li>' + (a.nome || '-') + (a.faixa ? ' <span style="color:#888">(' + a.faixa + ')</span>' : '') + ' &mdash; ' + N(a.aulas) + ' aulas</li>').join('');

const ocup = lista(det.ocupacao_por_horario).filter(o => o.capacidade > 0)
  .sort((a, b) => (b.taxa || 0) - (a.taxa || 0)).slice(0, 6)
  .map(o => linha(o.horario, P(o.taxa) + ' <span style="font-weight:400;color:#888">(' + N(o.presentes) + '/' + N(o.capacidade) + ')</span>')).join('');

const h2 = (t) => '<h2 style="font-size:16px;margin:26px 0 8px">' + t + '</h2>';

const html = [
  '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#17110f;max-width:640px">',
  '<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8e1f2b;font-weight:700;margin:0">Placar da Alliance SJC</p>',
  '<h1 style="font-size:26px;margin:6px 0 22px">' + titulo + '</h1>',
  '<h2 style="font-size:16px;margin:22px 0 8px">' + (doMes ? 'Última semana completa (' + semanaTxt + ')' : 'A semana') + '</h2>',
  tab(linha('Alunos novos', N(s.novos)) + linha('Retornos', N(s.retornos)) + linha('Cancelamentos', N(s.cancelamentos))
    + linha('Leads', N(s.leads)) + linha('Experimentais realizadas', N(s.experimentais_realizadas))
    + linha('Check-ins', N(s.checkins))
    + linha('Treinaram', N(s.alunos_que_treinaram) + ' de ' + N(m.alunos) + ' (' + P(s.pct_base_treinou) + ')')
    + linha('Adultos em risco', N(riscoTotal) + ' (' + P(s.pct_adultos_em_risco) + ')')),
  h2('O mês até aqui'),
  tab(linha('Alunos ativos', N(m.alunos)) + linha('Início do mês', N(inicio))
    + linha('Novos / Retornos / Cancelamentos', N(m.novos) + ' / ' + N(m.retornos) + ' / ' + N(m.cancelamentos))
    + linha('Crescimento líquido', P(cresc)) + linha('Churn', P(churn))
    + linha('Receita recorrente', R$(m.mrr)) + linha('Ticket médio', R$(ticket))
    + linha('Em atraso', R$(m.valorInad) + ' (' + P(inadPct) + ')')),
  riscoFaixa ? h2('Em risco, por tempo parado') + tab(obj2linhas(riscoFaixa)) : '',
  h2('Por que saíram'),
  tab(obj2linhas(det.motivos_cancelamento)),
  h2('Tempo de casa de quem saiu'),
  tab(obj2linhas(det.coortes_cancelamento)),
  h2('Inadimplência por idade'),
  tab(obj2linhas(det.aging_inadimplencia, R$)),
  h2('Horários mais cheios'),
  tab(ocup),
  h2('Origem dos leads'),
  tab(obj2linhas(det.canais_lead)),
  pipe.por_etapa ? h2('Pipeline de leads (' + N(pipe.abertos) + ' abertos, ' + N(pipe.janela_dias) + ' dias)') + tab(obj2linhas(pipe.por_etapa)) : '',
  top ? h2('Prioridade de contato') + '<ol style="font-size:14px;line-height:1.7;padding-left:20px">' + top + '</ol>' : '',
  exame ? h2('Prontos para o exame de faixa' + (aptosTotal !== null ? ' (' + N(aptosTotal) + ')' : '')) + '<ol style="font-size:14px;line-height:1.7;padding-left:20px">' + exame + '</ol>' : '',
  '<p style="margin:30px 0"><a href="' + cfg.urlPainel + '" style="background:#8e1f2b;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Abrir o painel</a></p>',
  '<hr style="border:0;border-top:1px solid #e2dcd9;margin:26px 0">',
  '<details><summary style="cursor:pointer;font-size:13px;color:#777">Cópia de segurança dos dados (guarde este e-mail)</summary>',
  '<pre style="font-size:10px;white-space:pre-wrap;word-break:break-all;color:#555;background:#f7f5f4;padding:12px;border-radius:6px">' + String(d.textoPuro || '').replace(/</g, '&lt;') + '</pre></details>',
  '<p style="font-size:12px;color:#999;margin-top:18px">Gerado automaticamente. Histórico com ' + d.resumo.meses_no_historico + ' mês(es).</p>',
  '</div>'
].join('');

return [{ json: {
  telefone: cfg.whatsapp,
  emails: cfg.emails,
  zap,
  assunto: 'Placar Alliance SJC - ' + titulo,
  html
} }];
