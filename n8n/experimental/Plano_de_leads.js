const agora = new Date(Date.now() - 10800000);
const ymd = (d) => d.toISOString().slice(0, 10);
const base = "https://evo-integracao.w12app.com.br/api";
const desde = ymd(new Date(agora.getTime() - 21 * 86400000));
/* 23/09/2026: a /v1/prospects some com o lead quando ele vira aluno, e a linha dele
   ficava presa como 'agendado' (caso Marcilio). A segunda chamada traz quem converteu
   nos ultimos 45 dias; o Apurar usa o telefone para marcar a linha como 'convertido'.
   07/10/2026: so na rodada completa (madrugada). Nas leves (15h e 21h30) a linha presa
   espera a madrugada seguinte para ser fechada — nenhuma mensagem depende disso. */
const desdeConv = ymd(new Date(agora.getTime() - 45 * 86400000));
const completa = agora.getUTCHours() < 12;
const pedidos = [
  { json: { rotulo: "leads", url: base + "/v1/prospects?take=50&skip=0&registerDateStart=" + desde + "&registerDateEnd=" + ymd(agora) } }
];
if (completa) pedidos.push({ json: { rotulo: "convertidos", url: base + "/v1/members?idBranch=54&take=150&skip=0&conversionDateStart=" + desdeConv + "&conversionDateEnd=" + ymd(agora) } });
return pedidos;
