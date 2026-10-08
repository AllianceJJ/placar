/* Fase 2 da coleta: a agenda individual de quem passou pela aula experimental ou
   introdutoria. A EVO guarda essa aula fora da grade em grupo, em
   /v2/activities/member/sessions, e so devolve o passado quando recebe
   dateStart/dateEnd. Enquanto a pessoa e lead ela sai por idProspect; depois que
   matricula, some do lead e passa a sair por idMember.
   A lista de quem perguntar sai das entradas: toda experimental vira uma entrada
   do tipo Agendamento, com o lead e, quando ja converteu, tambem o aluno. Depois
   completamos com os alunos e leads mais recentes, do mais novo para o mais velho,
   ate o teto de chamadas — a ordem importa porque e no fim da fila que estao as
   pessoas antigas, que nao tem experimental nenhuma para achar. */
const base = 'https://evo-integracao.w12app.com.br/api';
const res = $input.all().map(i => i.json);
const junta = (p) => { const o = []; for (const r of res) { if (r && r.rotulo && String(r.rotulo).indexOf(p + ':') === 0 && Array.isArray(r.itens)) o.push(...r.itens); } return o; };
const membros = junta('membros'), prospects = junta('prospects'), freq = junta('freq'), entradas = junta('entradas');

/* 06/10/2026: COMPLETAR PAGINACAO. O Plano de coleta pede um numero fixo de paginas e,
   quando a lista crescia alem disso, o resto era cortado em silencio. Foi o que
   aconteceu com 'atraso' (recebiveis vencidos em 180 dias): a EVO tinha 1.671 linhas
   e liamos 300, so de 08/04 a 12/05 — a inadimplencia de meados de maio em diante
   nunca entrava na conta. Toda rota paginada devolve o header 'total'; aqui pedimos
   exatamente as paginas que faltam, com rotulo proprio ('atraso:x300'), e o calculo
   junta tudo pelo prefixo como antes. Teto de seguranca de 120 paginas extras. */
const PAGINAS_EXTRAS_MAX = 120;
const grupoPag = {};
for (const r of res) {
  if (!r || !r.rotulo || !r.url) continue;
  const pre = String(r.rotulo).split(':')[0];
  const mT = /[?&]take=(\d+)/.exec(r.url), mS = /[?&]skip=(\d+)/.exec(r.url);
  if (!mT || !mS) continue;
  const take = Number(mT[1]), skip = Number(mS[1]);
  const tot = Number(r.cabecalho && r.cabecalho.total);
  const g = grupoPag[pre] || (grupoPag[pre] = { take: take, ate: 0, total: 0, url: r.url });
  g.ate = Math.max(g.ate, skip + take);
  if (isFinite(tot) && tot > g.total) g.total = tot;
}
/* 07/10/2026: contratos vigentes. Com o filtro de status valendo, a lista tem ~300 linhas e
   basta completar do comeco. Se a EVO voltar a ignorar o filtro (lista de 10 mil, ordenada
   pelo fim do contrato), os vigentes moram nas ultimas ~1.800 linhas: pede-se so a cauda. */
const CAUDA_CONTRATOS = 1800;
if (grupoPag.contratos && grupoPag.contratos.total > 2000) {
  const g = grupoPag.contratos;
  g.ate = Math.max(g.ate, Math.floor(Math.max(0, g.total - CAUDA_CONTRATOS) / g.take) * g.take);
}
const extras = [];
for (const pre of Object.keys(grupoPag)) {
  const g = grupoPag[pre];
  for (let s = g.ate; s < g.total && extras.length < PAGINAS_EXTRAS_MAX; s += g.take) {
    extras.push({ json: { rotulo: pre + ':x' + s, url: g.url.replace(/([?&]skip=)\d+/, (m0, p1) => p1 + s), paginaExtra: true } });
  }
}

/* 08/10/2026: VENDA NOVA x RENOVACAO. Para saber se quem comprou plano no mes ja teve
   contrato antes, pede o cadastro completo de cada comprador em /v1/members/{id}: ele traz
   'memberships' com TODOS os contratos (vigentes e vencidos), numa chamada so. Fica de fora
   a cobranca automatica do recorrente (idSaleRecurrency) e venda de R$ 0. Sao ~40 chamadas
   por rodada, as 5h (preco noturno). Quem usa e o no 'Vendas do mes'. */
const HIST_MAX = 120;
let iM = '', fM = '';
try { const p = $('Plano de coleta').first().json; iM = String(p.inicioMes || ''); fM = String(p.fimMes || ''); } catch (e) { iM = ''; fM = ''; }
const hist = [], vistoComp = {};
for (const v of junta('vendas')) {
  if (!v || v.idSaleRecurrency || !v.idMember || vistoComp[v.idMember]) continue;
  const d = String(v.saleDate || '').slice(0, 10);
  if (!d || !iM || d < iM || d > fM) continue;
  const temPlano = (Array.isArray(v.saleItens) ? v.saleItens : []).some(it => it && it.idMembership && ((Number(it.saleValue) || Number(it.itemValue) || 0) > 0));
  if (!temPlano) continue;
  vistoComp[v.idMember] = 1;
  if (hist.length < HIST_MAX) hist.push({ json: { rotulo: 'hist:' + v.idMember, url: base + '/v1/members/' + v.idMember } });
}

const hoje = new Date(Date.now() - 10800000);
const ymd = (d) => d.toISOString().slice(0, 10);
const menos = (n) => { const x = new Date(hoje); x.setUTCDate(x.getUTCDate() - n); return ymd(x); };
const de = menos(150);
const ate = ymd(new Date(hoje.getTime() + 7 * 86400000));
const corte = menos(120);

const fila = [], visto = {};
const por = (tipo, id) => {
  if (!id) return;
  const k = tipo + id;
  if (visto[k]) return; visto[k] = 1;
  fila.push({ tipo, id });
};

/* 1. lead com agendamento registrado: para quem ainda e lead, agendamento so pode
      ser experimental. Aluno antigo tambem gera agendamento ao reservar vaga em
      turma normal, entao ele nao entra por aqui — entra pelo passo 3, ja filtrado. */
const virouAluno = {};
for (const e of freq.concat(entradas)) {
  if (!e || e.entryType !== 'Agendamento') continue;
  if (e.idProspect && e.idMember) virouAluno[e.idProspect] = 1;
}
for (const e of freq.concat(entradas)) {
  if (!e || e.entryType !== 'Agendamento' || !e.idProspect) continue;
  if (!virouAluno[e.idProspect]) por('P', e.idProspect);
}

/* 2. alunos matriculados nos ultimos 120 dias — a experimental deles mudou de
      lado e so sai por idMember. Estes vem ANTES dos leads soltos de proposito:
      sao eles que sustentam a taxa de conversao, e quando a fila estourava o
      teto era justamente esta parte que ficava de fora, porque estava por
      ultimo. Sem eles, "matriculas vindas da experimental" sai subestimado. */
membros.filter(m => m.registerDate && String(m.registerDate).slice(0, 10) >= corte)
  .sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate)))
  .forEach(m => por('M', m.idMember));

/* 3. leads recentes que ainda nao viraram aluno — do mais novo para o mais velho.
      E aqui que aparece a falta: quem nao veio nao gera entrada. */
prospects.slice().sort((a, b) => String(b.registerDate || '').localeCompare(String(a.registerDate || '')))
  .forEach(p => { if (p.idProspect && !virouAluno[p.idProspect]) por('P', p.idProspect); });

/* Guarda de tempo. A fase 1 pode demorar o dobro num dia ruim da API, e a
   execucao inteira morre em 300s. Em vez de perder o relatorio, encolhemos a
   fila de leads: o painel sai com menos experimentais mapeadas, mas sai.
   O teto era 125 e a fila real de 01/09/2026 pedia 134 — cortava 9 pessoas
   e o funil saia incompleto. Subiu para 170, que ainda cabe no orcamento:
   170 chamadas a 0,8s dao 136s, e a fase 1 vinha gastando cerca de 60s. */
const TETO_MAX = 170;
const ORCAMENTO = 225;   /* segundos que a coleta pode gastar antes do calculo */
const CUSTO = 0.8;       /* segundos por chamada, medido com folga */
let t0 = 0;
try { t0 = Number($('Plano de coleta').first().json.t0) || 0; } catch (e) { t0 = 0; }
const gastos = t0 ? (Date.now() - t0) / 1000 : 0;
let TETO = TETO_MAX;
/* As paginas extras e os historicos saem do mesmo orcamento de tempo, antes da agenda dos leads. */
if (gastos > 0) TETO = Math.max(0, Math.min(TETO_MAX, Math.floor((ORCAMENTO - gastos - (extras.length + hist.length) * CUSTO) / CUSTO)));

const u = [];
for (const alvo of fila.slice(0, TETO)) {
  const campo = alvo.tipo === 'M' ? 'idMember' : 'idProspect';
  u.push({ json: { rotulo: 'agenda' + alvo.tipo + ':' + alvo.id, de, ate, teto: TETO, fase1: Math.round(gastos),
    filaTotal: fila.length, filaCortada: Math.max(0, fila.length - TETO),
    url: base + '/v2/activities/member/sessions?' + campo + '=' + alvo.id + '&dateStart=' + de + '&dateEnd=' + ate } });
}
/* 17/09/2026: a EVO devolve só 10 sessões quando não recebe take — aluno novo com muitas aulas perdia a experimental (caso Pablo). */
for (const it of u) { const j = it && it.json; if (j && typeof j.url === 'string' && !/[?&]take=/.test(j.url)) j.url += '&take=50'; }
return extras.concat(hist, u);