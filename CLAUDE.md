# Placar Alliance SJC — resumo para continuar no Claude Code

Atualizado em 24/09/2026. Dono: Eduard (sócio da Alliance Jiu-Jitsu São José dos Campos).

## 1. O que é o sistema

É o painel de gestão da academia, com as automações de WhatsApp em volta. O fluxo tem quatro etapas:

1. **EVO (W12)** é o CRM e a fonte de verdade: alunos, contratos, grade, check-ins e leads.
2. **n8n** (alliancesjc.app.n8n.cloud) coleta os dados da EVO, calcula os indicadores e dispara as réguas.
3. **Z-API** envia as mensagens de WhatsApp.
4. **GitHub Pages** (repositório `AllianceJJ/placar`) hospeda o painel (`index.html`), que lê um `dados.json` cifrado gravado pelo n8n.

## 2. Workflows principais (n8n)

| Workflow | ID | Quando roda | O que faz |
|---|---|---|---|
| Placar — Relatório | `uLpBvyCGdHS8e1RO` | Segunda 5h e dia 1º 5h | Chama a Coleta, grava o `dados.json` no GitHub, manda WhatsApp e e-mail |
| Placar — Coleta e Cálculo | `TlhqxSdMOllJHYQw` | Sub-workflow do Relatório | Puxa a EVO pelo Motor e calcula tudo |
| Placar — Motor EVO | `ZwLL2NKL4N13Fonr` | Sub-workflow | Executa as chamadas à EVO (a credencial fica aqui) |
| Fila de atendimento | `n5bMEu6rX5GzQfaq` | Segunda 7h | Classifica alunos e dispara as réguas automáticas |
| Experimental — no-show e pós-aula | `0BYwKSHio7SaumxA` | 5h30 (completa), 15h e 21h30 (leves) | Régua de leads que faltaram ou fizeram a experimental |
| Retenção 21 dias | `n89FvMSLcWhInbFl` | Webhook da EVO | Aluno ausente há 21 dias |
| Contagem de aulas | `1JDE7U8Ig899XHXV` | Diário 3h | Alimenta a Data Table "Aulas por aluno" |
| Workflow de erro | `U2Tv6yvMexNZyaei` | Em falha | Alerta de erro |

Data Tables principais:

| Data Table | ID |
|---|---|
| Aulas por aluno | `hlWNDMsifBDNBcpE` |
| Fila de atendimento | `WeF7Mk3KlopFLwcY` |
| Experimentais agendadas | `UYYjFipTElb1XI4i` |
| Registro de envios | `QNGfm5bsYmgPfTdc` |

## 3. O que mudou em 23–24/09/2026 (tudo publicado)

**Fila de atendimento: virou automática.**
- Saíram o formulário de desfecho e os blocos de contato humano.
- Nova régua `regua09-nunca-treinou` para quem matriculou e nunca treinou:
  - usa a idade pela `birthDate` da EVO;
  - **menores de 12 anos nunca recebem**;
  - sem data de nascimento, não envia e o nome vai para o grupo como cadastro a completar;
  - de 12 a 14 anos o texto fala com o responsável; de 15 em diante, com o aluno;
  - intervalo de 30 dias entre envios.
- O resumo no grupo VENDAS E GESTAO mostra "X enviadas · Y recebidas pelo WhatsApp · Z com falha". A contagem é feita **depois** do nó "Enviar ao aluno", pela presença de `zaapId`/`messageId`.
- Nova fiação: Montar fila → Somente com mensagem (sempre gera saída) → IF "Tem envio?" → Enviar ao aluno (continua em caso de erro) → Montar texto → Enviar ao grupo.

**Retenção 21: religada.** Ela só dispara se o passo de 21 dias também estiver ativo na automação de ausência da EVO. Conferir isso lá.

**Experimental: lead convertido.** O Plano de leads também busca `/v1/members` convertidos nos últimos 45 dias. Uma linha presa como "agendado", cujo telefone é de aluno ativo, vira `convertido`, sem enviar mensagem.

**Coleta: três nós novos.**
- **Grade de 4 semanas:** no escopo semanal, a grade passa de 12 para 31 dias. De quebra, a folha do mês deixou de ficar parcial depois do dia 12.
- **Mapa da grade:** gera `detalhe.mapa_grade` com a média de presenças por dia × horário, sem kids, baby e mirim.
- **Validar formato:** é o contrato de dados. Se um campo que o Relatório ou o painel consomem vier com o formato errado, ou se a base vier zerada, lança um erro e não entrega nada. Avisos leves ficam em `validacao.avisos`.
  - **Regra: toda mudança de formato na Coleta exige atualizar este nó e conferir os dois consumidores**, o Relatório e o `index.html`.

**Painel (`index.html`): cinco commits.**
1. **Projeção calibrada pelo histórico.** Parte das médias dos últimos 12 meses fechados, mais a tendência. Um backtest roda o modelo a partir de cada mês passado (42 origens) e compara com o real 12 meses depois:
   - conservador = percentil 10;
   - realista = mediana;
   - otimista = percentil 90.

   Os três só diferem nas entradas. O mês corrente fica de fora. Premissas salvas antes desta versão (sem `v:2`) são ignoradas. Números com a base de agosto, em 12 meses: ~330, ~372 e ~472 alunos.
2. **350 é o "número mágico":** é meta de referência, **não trava**. Os textos, o gráfico e o prompt foram ajustados.
3. **Juvenil (13+) entra na média por aula,** porque usa o app da EVO. Kids, baby e mirim ficam fora: `KIDS_RE = /KIDS|BABY|INFANTIL|MIRIM/i`.
4. **Alerta de dados velhos:** aviso vermelho no topo quando `atualizadoEm` passa de 8 dias.
5. **Mapa de calor da grade** (`blocoMapaGrade`), dentro da seção de grade.

## 3b. O que mudou em 06–07/10/2026 (publicado)

O código dos nós alterados e o detalhe de cada mudança estão em `n8n/` (veja `n8n/APLICAR.md`).

- **Relatório: o escopo vem do gatilho.** São dois gatilhos, "Segunda 5h" (semana) e "Dia 1o 5h" (fechamento).
  - A regra antiga, "dia ≤ 5 = mês", refez o fechamento de setembro na segunda 05/10.
  - Quando o dia 1º cair numa segunda, só o mensal roda.
- **Coleta: contratos lidos do começo da lista.** A EVO 2026.10.05.1 passou a respeitar `statusMemberMembership=1`: a lista caiu de 10.020 para 279 linhas e a cauda antiga vinha vazia. A "Agenda dos leads" volta a pedir a cauda se o total passar de 2.000.
- **Coleta: paginação completa pelo header `total`.** Os atrasos liam 300 de 1.671 linhas. Se alguma lista ainda vier cortada, o "Validar formato" marca `TRUNCADO` e o Relatório avisa no WhatsApp.
- **Novos = cadastro do período com contrato ou plano comprado.** O fechamento não muda mais conforme o dia em que roda. Conversão sem venda não é matrícula.
- **Folha:** conta até ontem e só aula individual **finalizada** no EVO (decisão do Eduard, 07/10). As não finalizadas aparecem numa lista no painel.
- **Oportunidades como a EVO conta:** `leads_evo` = oportunidades cadastradas no mês (abertas + convertidas). O pipeline não conta "Não deu certo" nem lead de quem já é aluno.
- **Data Table "Leads vistos"** (`gktn7Z9NzpG7aZEf`): a Coleta grava os leads a cada rodada. É dela que sai o canal e a data de cadastro de quem converteu, porque a EVO tira o lead de `/v1/prospects` na conversão.

## 3c. Custos (medido e otimizado em 07/10/2026)

- **EVO API:** é cobrada por chamada, e a diurna custa o dobro da noturna (antes das 6h), pelo preço que o Motor usa. O Motor grava tudo na tabela "Consumo EVO API". Num mês normal são ~4.300 chamadas e ~R$ 100; setembro chegou a R$ 205 por causa de testes. Antes da otimização, ~60% do custo vinha da régua da Experimental.
- **O que mudou em 07/10:**
  - Experimental: rodada completa às 5h30 (antes 8h); 15h e 21h30 em modo leve, só para leads com aula marcada, cadastro recente ou etapa AULA AGENDADA.
  - Base do dia: às 5h (antes 7h40).
  - Copiloto do Instagram: a cada 10 min, das 7h às 22h (antes 5 min, 24h).
  - Copiloto do WhatsApp: 10 min de dia e 30 min de madrugada.
  - O código publicado da Experimental está em `n8n/experimental/`.
- **n8n:** em 7 dias foram 3.507 execuções, 87% delas dos dois copilotos. Com os horários novos, devem cair para perto da metade.
- **Teste sem custo:** antes de testar contra a EVO, use `n8n/teste/` (código rodando no navegador com a saída de uma execução real).

## 3d. O que mudou em 08/10/2026 (publicado)

- **Venda nova × renovação na Coleta.** A "Agenda dos leads" pede `/v1/members/{id}` de cada comprador de plano do mês (rótulo `hist:`). Essa rota traz `memberships`, com todos os contratos, vigentes e vencidos, numa chamada só. O nó novo **"Vendas do mes"**, entre o "Complementar indicadores" e o "Mapa da grade", gera:
  - `mes.vendas_novas`, `mes.vendas_renovacao` e `detalhe.vendas_do_mes`;
  - a observação de cada renovação: retorno, mesmo plano, troca de plano ou contrato adicional.

  Mesmo plano é o mesmo `idMembership` ou o mesmo nome sem parêntese e sem ano. Testado com setembro (32 vendas: 18 novas, 14 renovações) e com outubro (7: 4 + 3).
- **Motor EVO: contador sem perda.** Cada execução grava um lançamento na Data Table "Consumo EVO — lançamentos" (`rkqVjrUFmMJEcIBa`), e o total do mês é a soma deles. Antes, réguas disparadas em lote pela EVO rodavam o Motor ao mesmo tempo e uma execução apagava a soma da outra (~13% a menos que a tela da EVO). O saldo inicial de outubro foi copiado da tela da EVO.
- **Régua de Oportunidades:**
  - lê a EVO pelo Motor;
  - escreve o nome sem caixa alta;
  - não manda mais nada para lead "NÃO DEU CERTO".
- **Copilotos por evento (economia de execuções no n8n):**
  - o do Instagram roda dentro de "Instagram — comentários e DMs", com espera de 200s;
  - o do WhatsApp roda dentro de "Respostas do WhatsApp — recebimento" das 7h às 21h, com espera de 320s e só sugestão;
  - à noite fica o workflow antigo, a cada 30 min, com a resposta automática em assunto liberado;
  - ao mudar o prompt, mudar nos dois lugares.
- **Ranking do Mês duplicado desligado** ("top 5 da catraca"). Workflows de teste foram movidos para as pastas "Manutenção — rodar na mão" e "Arquivo — testes, sondas e desligados".
- **Plano do n8n:** Pro, com 10 mil execuções por mês. Em 07/10 já eram 5.788. O webhook de respostas do WhatsApp sozinho faz ~370 por dia. Upgrade pendente com o Eduard.

## 4. Decisões do Eduard (não reabrir)

- Infantil **nunca** terá chamada de presença. A leitura é feita por contrato e pela faixa infantil na ficha.
- O ajuste manual da quantidade de aulas por professor foi **descartado**.
- As mensagens automáticas saem cedo (por volta das 5h) de propósito, porque é mais barato.
- Na régua "nunca treinou", menores de 12 anos nunca recebem mensagem.
- Nas mensagens: a partir de 15 anos o texto fala com o aluno; abaixo disso, com o responsável.
- O tom é sério e amigável, sem cara de IA e sem excesso de emoji. Textos novos passam pela aprovação dele antes de ir ao ar.
- Publicar workflow em produção sempre com o conhecimento dele.

## 5. Pegadinhas da EVO API (confirmadas)

- `/v1/prospects` **deixa de devolver o lead quando ele converte**. Para convertidos, use `/v1/members` (`conversionDate`).
- `/v2/activities/member/sessions` devolve só 10 sessões sem `&take=`. Sempre passar `take`.
- `/v1/members` não filtra status: vem a base inteira em páginas de 150. `membershipStatus: "Suspended"` indica contrato congelado.
- A presença na agenda vem `true` já no agendamento. Quem separa aula dada de aula futura é `isFinalized`.
- O telefone fica em `contacts[]` (`description` + `ddi`), não num campo solto.
- `/v3/membermembership?statusMemberMembership=1` passou a filtrar de verdade em 10/2026 (279 linhas em vez de 10 mil). Não presuma o tamanho de lista nenhuma: confira o header `total`.
- Toda rota paginada devolve o header `total`. Página fixa no Plano corta em silêncio: foi o caso dos recebíveis em atraso.
- A saída de um nó de Data Table só carrega as colunas mapeadas. **Nunca** encadear um filtro que depende de campo calculado depois de um upsert. Esse foi o bug da Fila em 07/09.

## 6. Para conferir na segunda, 28/09

1. **5h, Relatório/Coleta:**
   - o nó "Validar formato" passou, e `validacao.avisos` veio vazio ou razoável;
   - `diagnostico.dias_de_grade_pedidos` = 31;
   - `detalhe.mapa_grade.celulas` veio preenchido;
   - o painel mostra o mapa de calor;
   - a execução ficou dentro dos 300s (a grade maior custa cerca de 15s);
   - o funil não ficou truncado (`funil_diagnostico.fila_truncada`).
2. **7h, Fila:**
   - "Enviar ao aluno" executou;
   - o resumo no grupo mostra enviadas, recebidas e falhas coerentes;
   - nenhum menor de 12 anos recebeu a régua "nunca treinou";
   - os cadastros sem data de nascimento aparecem listados.
3. **Experimental:** linhas de leads já convertidos que estavam presas como "agendado" passaram para `convertido`.

## 7. Como editar

- O painel é um arquivo só, `index.html`, com cerca de 207 KB e o JavaScript inline. O HTML/JS pode ser testado localmente com `node --check` e rodando as funções de cálculo (`premissas`, `projetar`, `cenariosPadrao`) sobre o array `HISTORICO`.
- O `dados.json` é cifrado. O painel descriptografa no navegador com a senha.
- No n8n, sempre ler o workflow antes de editar e salvar como rascunho. O Eduard publica, ou autoriza a publicação.
