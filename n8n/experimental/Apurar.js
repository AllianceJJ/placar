const res = $input.all().map(i => i.json);
const porRotulo = {};
for (const r of res) if (r && r.rotulo) porRotulo[r.rotulo] = r;
const leads = $("Selecionar leads").all().map(i => i.json).filter(x => x && x.idProspect);
const dadosLead = {};
for (const l of leads) dadosLead[String(l.idProspect)] = l;
let tabela = [];
try { tabela = $("Ler agendados").all().map(i => i.json).filter(x => x && x.chave); } catch (e) { tabela = []; }
const antes = {};
for (const l of tabela) antes[String(l.chave)] = l;
/* 23/09/2026: telefones de quem ja e aluno ativo (convertido nos ultimos 45 dias).
   Serve so para fechar linha orfa: lead que virou aluno some da /v1/prospects. */
const CEL = /^55[1-9][0-9]9[0-9]{8}$/;
const alunoAtivo = {};
try {
  for (const r of $("Motor EVO - leads").all().map(i => i.json)) {
    if (!r || String(r.rotulo || "") !== "convertidos" || !Array.isArray(r.itens)) continue;
    for (const m of r.itens) {
      if (!m || String(m.status || "") !== "Active") continue;
      const cs = Array.isArray(m.contacts) ? m.contacts : [];
      for (const c of cs) {
        const num = String((c && c.description) || "").replace(/[^0-9]/g, "");
        if (!num) continue;
        const cheio = (num.indexOf("55") === 0 && (num.length === 12 || num.length === 13)) ? num : "55" + num;
        if (CEL.test(cheio)) alunoAtivo[cheio] = true;
      }
    }
  }
} catch (e) {}
const agora = new Date(Date.now() - 10800000);
const agoraMs = agora.getTime();
const iso = agora.toISOString();
const APELIDO = { "ALLIANCE JIU JITSU": "Alessandro" };
const titulo = (s) => s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()) : "";
const primeiroNome = (n) => {
  const x = String(n || "").trim();
  if (!x) return "";
  const c = APELIDO[x.toUpperCase()];
  if (c) return c;
  return titulo(x.split(/\s+/)[0]);
};
const horaBR = (h) => {
  const p = String(h || "").split(":");
  if (p.length < 2) return String(h || "");
  const hh = String(Number(p[0]));
  return p[1] === "00" ? hh + "h" : hh + "h" + p[1];
};
const simples = (s) => String(s || "").normalize("NFD").replace(/[^A-Za-z0-9 |-]/g, "").toLowerCase();
const ehExperimental = (s) => {
  if (String(s.code || "").toLowerCase().indexOf("experimental") >= 0) return true;
  const n = simples(s.activitieName);
  return n.indexOf("experimental") >= 0 || n.indexOf("introdut") >= 0;
};
const ehComplementar = (s) => /(aula|introdutoria)\s*[|-]?\s*[23]\b/.test(simples(s.activitieName));
const quandoMsDe = (data, hora) => Date.parse(data + "T" + (hora || "00:00") + ":00-03:00");
const diasEntre = (a, b) => {
  const x = Date.parse(a + "T12:00:00Z"), y = Date.parse(b + "T12:00:00Z");
  if (!isFinite(x) || !isFinite(y)) return null;
  return Math.round((y - x) / 86400000);
};
const hojeYMD = iso.slice(0, 10);
const TETO_ENVIOS = 12;
const ESPERA_MIN = 90;
let enviadas = 0;
const vistos = {};
const linhas = [];
for (const lead of leads) {
  const r = porRotulo["agenda:" + lead.idProspect];
  if (!r || r.ok !== true || !Array.isArray(r.itens)) continue;
  for (const s of r.itens) {
    if (!s || !s.date) continue;
    if (!ehExperimental(s) || ehComplementar(s)) continue;
    const data = String(s.date).slice(0, 10);
    const hora = String(s.startTime || "").slice(0, 5);
    const chave = lead.idProspect + "|" + data + "|" + hora;
    vistos[chave] = true;
    const ant = antes[chave] || {};
    const quando = quandoMsDe(data, hora);
    const passouMin = isFinite(quando) ? (agoraMs - quando) / 60000 : -1;
    const status = passouMin >= ESPERA_MIN ? "compareceu" : "agendado";
    linhas.push({
      chave: chave, idProspect: lead.idProspect, nome: lead.nome, telefone: lead.telefone,
      terceiro: lead.menor === true || lead.compartilhado === true,
      semIdade: lead.semIdade === true && lead.menor !== true && lead.compartilhado !== true,
      data: data, hora: hora, professor: primeiroNome(s.instructor), status: status,
      ultimoToque: String(ant.ultimoToque || ""), ultimoToqueEm: String(ant.ultimoToqueEm || "")
    });
  }
}
for (const l of tabela) {
  const chave = String(l.chave);
  if (vistos[chave]) continue;
  if (String(l.status || "") !== "agendado") continue;
  const lead = dadosLead[String(l.idProspect)];
  if (!lead) {
    /* Lead sumiu da lista de abertos. Se o telefone e de aluno ativo, virou matricula:
       fecha a linha como 'convertido'. Nenhuma mensagem sai para esse status. */
    const f = String(l.telefone || "");
    if (f && alunoAtivo[f]) {
      linhas.push({
        chave: chave, idProspect: String(l.idProspect), nome: String(l.nome || ""), telefone: f,
        terceiro: false, semIdade: false,
        data: String(l.data), hora: String(l.hora), professor: String(l.professor || ""), status: "convertido",
        ultimoToque: String(l.ultimoToque || ""), ultimoToqueEm: String(l.ultimoToqueEm || "")
      });
    }
    continue;
  }
  const quando = quandoMsDe(String(l.data), String(l.hora));
  const passouMin = isFinite(quando) ? (agoraMs - quando) / 60000 : -1;
  if (passouMin < ESPERA_MIN) continue;
  linhas.push({
    chave: chave, idProspect: String(l.idProspect), nome: String(l.nome || ""), telefone: String(l.telefone || ""),
    terceiro: lead.menor === true || lead.compartilhado === true,
    semIdade: lead.semIdade === true && lead.menor !== true && lead.compartilhado !== true,
    data: String(l.data), hora: String(l.hora), professor: String(l.professor || ""), status: "faltou",
    ultimoToque: String(l.ultimoToque || ""), ultimoToqueEm: String(l.ultimoToqueEm || "")
  });
}
/* 08/10/2026 (pedido do Eduard): UMA regua de pos-aula por PESSOA, nao por aula.
   Antes cada aula experimental tinha a sua sequencia D1/D3/D7: quem fez duas aulas
   recebia D1 e D3 em dobro (casos 71599 e 71945, set-out/2026). Agora:
   - o nivel do lead e o maior toque ja dado em QUALQUER aula dele nos ultimos 30 dias;
   - so a aula mais recente que ele compareceu anda com a regua (os dias contam dela);
   - cada mensagem tem prazo: D1 no 1o ou 2o dia, D3 do 3o ao 5o, D7 no 7o ou 8o.
     O prazo existe porque a consulta passou a olhar 8 dias para tras (era 3, por isso
     o D7 nunca tinha saido); sem ele, aula antiga sem toque dispararia um D1 atrasado. */
const RANK = { d1: 1, d3: 2, d7: 3 };
const corte30 = new Date(agoraMs - 30 * 86400000).toISOString().slice(0, 10);
const nivelLead = {};
const ultimaAula = {};
const sobe = (id, t) => { const r = RANK[String(t || "")] || 0; if (r > (nivelLead[id] || 0)) nivelLead[id] = r; };
for (const l of tabela) if (String(l.data || "") >= corte30) sobe(String(l.idProspect), l.ultimoToque);
for (const l of linhas) {
  if (l.status !== "compareceu") continue;
  sobe(String(l.idProspect), l.ultimoToque);
  const k = l.data + " " + l.hora;
  if (!ultimaAula[String(l.idProspect)] || k > ultimaAula[String(l.idProspect)]) ultimaAula[String(l.idProspect)] = k;
}
const assina = (p) => p ? (" — " + p) : " — Equipe Alliance SJC";
const foneUsado = {};
const saida = [];
for (const l of linhas) {
  let mensagem = "";
  let fluxo = "";
  const dias = diasEntre(l.data, hojeYMD);
  const hbr = horaBR(l.hora);
  const podeFalar = !!l.telefone && !foneUsado[l.telefone] && enviadas < TETO_ENVIOS;
  const quem = l.terceiro ? ("Oi! Aqui é " + (l.professor || "a equipe") + ", da Alliance SJC. ") : "";
  const abre = "Oi! Aqui é " + (l.professor || "a equipe") + ", da Alliance SJC. ";
  if (podeFalar) {
    if (l.status === "faltou" && l.ultimoToque === "") {
      fluxo = "Experimental no-show";
      if (l.terceiro) {
        mensagem = quem + "O " + l.nome + " tinha aula experimental hoje às " + hbr + " e a gente não chegou a ver por aqui — sem problema, acontece.\n\nQuer que eu remarque? Me diz o dia e o horário que encaixam melhor para vocês esta semana que eu já separo o lugar.";
      } else if (l.semIdade) {
        mensagem = abre + "A aula experimental marcada no nome de " + l.nome + " era hoje às " + hbr + " e acabou não rolando — sem problema, acontece.\n\nQuer que eu remarque? Me diz o dia e o horário que encaixam melhor esta semana que eu já separo o lugar.";
      } else {
        mensagem = l.nome + ", tudo bem? Você tinha aula hoje às " + hbr + " e a gente não te viu por aqui — sem problema, acontece com todo mundo.\n\nQuer que eu remarque? Me diz o dia e o horário que encaixam melhor esta semana que eu já separo o seu lugar." + assina(l.professor);
      }
    } else if (l.status === "compareceu" && dias !== null && ultimaAula[String(l.idProspect)] === (l.data + " " + l.hora)) {
      const nivel = nivelLead[String(l.idProspect)] || 0;
      if (nivel === 0 && dias >= 1 && dias <= 2) {
        fluxo = "Pós-experimental D1";
        const abertura = l.professor ? ("aqui é " + l.professor) : "aqui é a equipe da Alliance SJC";
        if (l.terceiro) {
          mensagem = quem + "Como o " + l.nome + " ficou depois da primeira aula? Quem sai do tatame pela primeira vez costuma sair muito animado ou meio cansado — as duas coisas são bom sinal.\n\nQueria saber o que vocês acharam, sinceramente.";
        } else if (l.semIdade) {
          mensagem = abre + "Como foi a primeira aula de " + l.nome + "? Quem sai do tatame pela primeira vez costuma sair muito animado ou meio cansado — as duas coisas são bom sinal.\n\nQueria saber o que achou, sinceramente: o que foi melhor e o que foi mais difícil?";
        } else {
          mensagem = l.nome + ", " + abertura + ". Como você está hoje? Primeira aula sempre deixa alguma marca — parte disso é bom sinal.\n\nQueria saber o que você achou, sinceramente. O que foi melhor e o que foi mais difícil?";
        }
      } else if (nivel === 1 && dias >= 3 && dias <= 5) {
        fluxo = "Pós-experimental D3";
        if (l.terceiro) {
          mensagem = "Sobre o " + l.nome + ": treinando duas vezes por semana, em três meses a diferença é grande — no começo a evolução vem rápido.\n\nQuer que eu guarde o lugar na turma?" + assina(l.professor);
        } else if (l.semIdade) {
          mensagem = "Pensando pra frente: treinando duas vezes por semana, em três meses a diferença é grande — no começo a evolução vem rápido.\n\nQuer que eu guarde o lugar de " + l.nome + " na turma?" + assina(l.professor);
        } else {
          mensagem = l.nome + ", pensando pra frente: treinando duas vezes por semana, em três meses você já está passando para quem chegou depois o que aprendeu naquela primeira aula. É mais rápido do que parece.\n\nQuer que eu guarde o seu lugar na turma?" + assina(l.professor);
        }
      } else if (nivel === 2 && dias >= 7 && dias <= 8) {
        fluxo = "Pós-experimental D7";
        if (l.terceiro) {
          mensagem = "Uma semana desde a aula do " + l.nome + ". Não vou insistir — só quero saber se ficou alguma dúvida: valor, horário, ou vontade de fazer mais uma aula antes de decidir.\n\nQualquer uma das três eu resolvo hoje." + assina(l.professor);
        } else if (l.semIdade) {
          mensagem = "Uma semana desde a aula de " + l.nome + ". Não vou insistir — só quero saber se ficou alguma dúvida: valor, horário, ou vontade de fazer mais uma aula antes de decidir.\n\nQualquer uma das três eu resolvo hoje. E se não for o momento, sem problema: é só me avisar que eu paro por aqui." + assina(l.professor);
        } else {
          mensagem = l.nome + ", uma semana desde a sua aula. Não vou insistir — só quero saber se ficou alguma dúvida: valor, horário, ou vontade de fazer mais uma antes de decidir.\n\nQualquer uma das três eu resolvo hoje. E se não for o momento, sem problema: me avisa que eu paro por aqui." + assina(l.professor);
        }
      }
    }
  }
  let toque = l.ultimoToque;
  if (mensagem) {
    enviadas += 1;
    foneUsado[l.telefone] = true;
    toque = fluxo === "Experimental no-show" ? "noshow" : (fluxo === "Pós-experimental D1" ? "d1" : (fluxo === "Pós-experimental D3" ? "d3" : "d7"));
  }
  saida.push({ json: {
    chave: l.chave, idProspect: l.idProspect, nome: l.nome, telefone: l.telefone,
    data: l.data, hora: l.hora, professor: l.professor, status: l.status,
    ultimoToque: toque, ultimoToqueEm: mensagem ? iso : l.ultimoToqueEm,
    atualizadoEm: iso, mensagem: mensagem, fluxo: fluxo,
    terceiro: l.terceiro === true, semIdade: l.semIdade === true
  } });
}
return saida;
