const res = $input.all().map(i => i.json);
const leads = [];
for (const r of res) {
  if (!r || String(r.rotulo || "") !== "leads" || !Array.isArray(r.itens)) continue;
  for (const p of r.itens) leads.push(p);
}
const agora = new Date(Date.now() - 10800000);
const ymd = (d) => d.toISOString().slice(0, 10);
const de = ymd(new Date(agora.getTime() - 3 * 86400000));
const ate = ymd(new Date(agora.getTime() + 7 * 86400000));
const base = "https://evo-integracao.w12app.com.br/api";
const TETO = 30;
const CELULAR = /^55[1-9][0-9]9[0-9]{8}$/;
const foneDe = (p) => {
  const bruto = String(p.cellphone || p.phone || p.mobilePhone || p.telephone || "").replace(/[^0-9]/g, "");
  if (!bruto) return "";
  const cheio = (bruto.indexOf("55") === 0 && (bruto.length === 12 || bruto.length === 13)) ? bruto : "55" + bruto;
  return CELULAR.test(cheio) ? cheio : "";
};
/* a EVO devolve o nome em caixa alta; em WhatsApp caixa alta soa como grito */
const titulo = (s) => s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()) : "";
const idadeDe = (v) => {
  const d = String(v || "").slice(0, 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)) return null;
  const n = Date.parse(d + "T12:00:00Z");
  if (!isFinite(n)) return null;
  return Math.floor((agora.getTime() - n) / (365.25 * 86400000));
};
const abertos = [];
for (const p of leads) {
  if (!p || !p.idProspect) continue;
  if (p.conversionDate) continue;
  if (p.idMember) continue;
  abertos.push(p);
}
/* A EVO quase nunca traz birthDate (20 de 22 leads vieram nulos em 03/09/26), entao
   idade sozinha nao identifica crianca. O sinal que existe de verdade e o telefone
   repetido: quando o mesmo numero aparece em dois ou mais leads abertos, quem le o
   WhatsApp nao e necessariamente quem esta na lista de chamada — e o responsavel,
   o pai, a mae ou o conjuge. Nesses casos a mensagem fala DA pessoa, nao COM ela. */
const contaFone = {};
const contaEmail = {};
for (const p of abertos) {
  const f = foneDe(p);
  if (f) contaFone[f] = (contaFone[f] || 0) + 1;
  const e = String(p.email || "").trim().toLowerCase();
  if (e) contaEmail[e] = (contaEmail[e] || 0) + 1;
}
abertos.sort((a, b) => String(b.registerDate || "").localeCompare(String(a.registerDate || "")));
/* 07/10/2026: RODADA COMPLETA x RODADA LEVE (economia de chamadas na EVO).
   A rodada da madrugada (5h30, preco noturno) consulta a agenda de todos os leads
   abertos, como antes. As rodadas da tarde e da noite (15h e 21h30, preco diurno)
   so consultam quem pode ter aula a fotografar ou falta a detectar:
   - quem tem experimental marcada na tabela (status agendado, de ontem em diante);
   - quem se cadastrou nos ultimos 2 dias (pode ter marcado aula hoje);
   - quem esta na etapa "AULA AGENDADA" do CRM.
   Em 07/10 as 15h foram 22 consultas para achar 3 leads com aula na janela.
   As mensagens de D1 e D3 saem na rodada completa; a leve so fotografa e acha falta.
   O telefone repetido (irmaos) continua sendo contado sobre TODOS os leads abertos. */
const completa = agora.getUTCHours() < 12;
let alvos = abertos;
if (!completa) {
  const ontem = ymd(new Date(agora.getTime() - 86400000));
  const doisDias = ymd(new Date(agora.getTime() - 2 * 86400000));
  const marcado = {};
  try {
    for (const l of $("Ler agendados").all().map(i => i.json)) {
      if (l && String(l.status || "") === "agendado" && String(l.data || "") >= ontem) marcado[String(l.idProspect)] = true;
    }
  } catch (e) { /* sem tabela, fica so com cadastro novo e etapa do CRM */ }
  alvos = abertos.filter(p => marcado[String(p.idProspect)]
    || String(p.registerDate || "").slice(0, 10) >= doisDias
    || /AULA AGENDADA/i.test(String(p.currentStep || "")));
}
const saida = [];
for (const p of alvos.slice(0, TETO)) {
  const idade = idadeDe(p.birthDate);
  const fone = foneDe(p);
  const email = String(p.email || "").trim().toLowerCase();
  const repetido = (!!fone && contaFone[fone] > 1) || (!!email && contaEmail[email] > 1);
  saida.push({ json: {
    rotulo: "agenda:" + p.idProspect,
    url: base + "/v2/activities/member/sessions?idProspect=" + p.idProspect + "&dateStart=" + de + "&dateEnd=" + ate,
    idProspect: String(p.idProspect),
    nome: titulo(String(p.firstName || "").trim()),
    telefone: fone,
    idade: idade === null ? -1 : idade,
    menor: idade !== null && idade < 18,
    /* Decisao do Eduard em 06/09/2026: lead sem data de nascimento passa a ser
       tratado como terceiro. Antes, o menor filho unico — sem irmao na base para
       repetir o telefone — recebia a mensagem escrita para ele mesmo. O preco e
       que a maioria dos leads cai nessa faixa, porque a EVO quase nunca preenche
       birthDate. Por isso existe uma redacao neutra propria para esse caso, que
       serve tanto ao proprio aluno quanto a mae dele. */
    semIdade: idade === null,
    compartilhado: repetido
  } });
}
if (saida.length === 0) {
  saida.push({ json: { rotulo: "vazio", url: base + "/v1/configuration", semLeads: true } });
}
return saida;
