const arg = $input.first().json || {};
const escopo = arg.escopo === 'mes' ? 'mes' : 'semana';
const base = 'https://evo-integracao.w12app.com.br/api';
const BRANCH = 54;

const TZ = -3;
const agora = new Date(Date.now() + TZ * 3600000);
const ymd = (d) => d.toISOString().slice(0, 10);
const menos = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - n); return x; };

const diaSemana = agora.getUTCDay();
const fimSemana = menos(agora, diaSemana === 0 ? 7 : diaSemana);
const inicioSemana = menos(fimSemana, 6);

const refMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
if (escopo === 'mes' && agora.getUTCDate() <= 5) refMes.setUTCMonth(refMes.getUTCMonth() - 1);
const inicioMes = new Date(refMes);
const fimMes = new Date(Date.UTC(refMes.getUTCFullYear(), refMes.getUTCMonth() + 1, 0));
const fimMesReal = fimMes > agora ? agora : fimMes;

const periodo = escopo === 'mes'
  ? { de: ymd(inicioMes), ate: ymd(fimMesReal) }
  : { de: ymd(inicioSemana), ate: ymd(fimSemana) };

const chaveMes = ymd(inicioMes).slice(0, 7);
/* Marca de inicio da coleta. A fase 2 usa isso para saber quanto tempo sobrou
   antes dos 300s da execucao e encolher a fila em vez de estourar o limite. */
const t0 = Date.now();
const u = [];
const add = (rotulo, url) => u.push({ json: { rotulo, url, escopo, periodo, chaveMes, t0,
  inicioMes: ymd(inicioMes), fimMes: ymd(fimMesReal),
  inicioSemana: ymd(inicioSemana), fimSemana: ymd(fimSemana) } });

/* /v1/members no lugar de /v2/members. As duas listagens tem exatamente os mesmos
   campos, mas a v2 devolve membershipStatus VAZIO e a v1 devolve preenchido
   (Active / Inactive / Suspended). E o unico lugar da API publica onde o
   congelamento de contrato aparece — sondado e confirmado em 02/09/2026, depois
   de sete rotas testadas antes que nao tinham nada.
   A v1 nao aceita filtro de status, entao vem a base inteira e o corte e feito
   no calculo. Sao 759 cadastros e a pagina trava em 150 itens (take=200 devolve
   150 do mesmo jeito), logo 6 paginas com passo de 150 — passo de 200 pularia
   a faixa 150-199. */
for (let p = 0; p < 6; p++) add('membros:' + p, base + '/v1/members?idBranch=' + BRANCH + '&take=150&skip=' + (p * 150));

/* Contratos vigentes. A EVO devolve a lista ordenada pela data de termino (crescente)
   e so aceita take=25 — take=50 e take=100 foram testados em 02/09/2026 e devolveram
   25 assim mesmo. Entao lemos a cauda: e la que moram todos os contratos que ainda
   estao valendo. Ancora medida em 02/09/2026 = 9717 linhas, crescendo ~9,3/dia.
   O contrato vigente mais antigo estava 1.476 linhas antes do fim, por isso a janela
   de 1.800 linhas de folga.

   O numero de paginas agora e CALCULADO, nao fixo. Antes eram 85 paginas fixas, que
   passavam ~325 linhas do fim da lista (13 paginas vazias pagas por rodada) e que
   iriam ficar curtas sozinhas conforme a base crescesse. O calculo cobre exatamente
   da cauda ate 100 linhas depois do fim estimado, nem mais nem menos.
   Confira o header 'total' no diagnostico: e a EVO dizendo o tamanho real da lista.

   07/10/2026: a EVO mudou (versao 2026.10.05.1). O filtro statusMemberMembership=1 passou
   a valer: a lista caiu de 10.020 linhas para 279, e a cauda que liamos (skip 8.225) veio
   vazia — a base saiu ZERADA no teste e o Validar formato parou a coleta. Agora lemos do
   comeco, 16 paginas (400 contratos). A Agenda dos leads completa o que faltar pelo header
   'total' e, se a EVO voltar a ignorar o filtro (total acima de 2.000), pede a cauda como antes. */
for (let p = 0; p < 16; p++) add('contratos:' + p, base + '/v3/membermembership?statusMemberMembership=1&take=25&skip=' + (p * 25));

for (let p = 0; p < 2; p++) add('cancel:' + p, base + '/v3/membermembership?take=25&skip=' + (p * 25)
  + '&cancelDateStart=' + ymd(inicioMes) + '&cancelDateEnd=' + ymd(fimMesReal));

/* Cancelamentos dos ultimos 12 meses: serie mensal de churn e motivos.
   Foram 123 linhas no ultimo levantamento; 6 paginas de 25 dao folga. */
for (let p = 0; p < 6; p++) add('churn:' + p, base + '/v3/membermembership?take=25&skip=' + (p * 25)
  + '&cancelDateStart=' + ymd(menos(agora, 365)) + '&cancelDateEnd=' + ymd(agora));

/* 3.400 vendas em 12 meses, ~283 por mes. 5 paginas de 100 dao folga para o pico. */
for (let p = 0; p < 5; p++) add('vendas:' + p, base + '/v2/sales?take=100&skip=' + (p * 100)
  + '&dateSaleStart=' + ymd(inicioMes) + '&dateSaleEnd=' + ymd(fimMesReal));

for (let p = 0; p < 6; p++) add('receb:' + p, base + '/v1/receivables?take=50&skip=' + (p * 50)
  + '&dueDateStart=' + ymd(inicioMes) + '&dueDateEnd=' + ymd(fimMes));

for (let p = 0; p < 6; p++) add('atraso:' + p, base + '/v1/receivables?take=50&skip=' + (p * 50)
  + '&dueDateStart=' + ymd(menos(agora, 180)) + '&dueDateEnd=' + ymd(menos(agora, 1)));

for (let p = 0; p < 2; p++) add('entradas:' + p, base + '/v1/entries?take=1000&skip=' + (p * 1000)
  + '&registerDateStart=' + periodo.de + '&registerDateEnd=' + periodo.ate);

for (let p = 0; p < 3; p++) add('freq:' + p, base + '/v1/entries?take=1000&skip=' + (p * 1000)
  + '&registerDateStart=' + ymd(menos(agora, 60)) + '&registerDateEnd=' + ymd(agora));

/* Leads de 120 dias: a matricula costuma vir semanas depois da experimental,
   entao a janela de 60 dias cortava justamente quem converteu. */
for (let p = 0; p < 2; p++) add('prospects:' + p, base + '/v1/prospects?take=50&skip=' + (p * 50)
  + '&registerDateStart=' + ymd(menos(agora, 120)) + '&registerDateEnd=' + ymd(agora));

/* Grade dos ultimos 35 dias: cobre a semana do relatorio e o mes inteiro no fechamento.
   E dela que saem aulas por professor, modalidades dadas e ocupacao por horario. */
const diasDeGrade = escopo === 'mes' ? 35 : 12;
for (let d = 0; d < diasDeGrade; d++) add('sessoes:' + d, base + '/v1/activities/schedule?date=' + ymd(menos(agora, d)) + '&take=1000');

return u;