# Contrato de dados do Placar

Lista de tudo o que o painel (`index.html`) lê do `dados.json`. É a mesma lista que está
no código (`CONTRATO` e `CONTRATO_MES`) e a base para o nó **"Validar formato"** da
Coleta no n8n. **Mudou num lugar, muda no outro.**

## Como ler

- **Obrigatório**: se faltar ou vier com formato errado, a seção mostra "dado indisponível".
- **Opcional**: pode faltar. Se vier, precisa ter o formato certo; se vier errado, a seção
  também mostra "dado indisponível".
- `[]` quer dizer "cada item da lista".
- Tipos: **número** (número de verdade, não texto como `"100.500"`), **texto**, **lista**,
  **objeto**, **mês** (`AAAA-MM`, ex.: `2026-09`), **data** (ISO, ex.: `2026-09-21T08:02:49Z`).
- **Na Coleta**: o `dados.json` é montado pelo nó "Montar e criptografar" do Relatório.
  O mês da Coleta (`mes.*`) vira o último item de `meses[]`; `base`, `detalhe` e
  `diagnostico` passam com o mesmo nome. `atualizadoEm` e `declaracoes` são criados no
  Relatório, não na Coleta.

## Aviso de dados velhos

| Campo | Tipo | Obrigatório | Na Coleta |
|---|---|---|---|
| `atualizadoEm` | data | sim | criado no Relatório |

Mais de 8 dias: aviso amarelo. Mais de 15 dias: aviso vermelho. Sem data: aviso amarelo
dizendo que não dá para saber a idade dos dados.

## Mês (`meses[]`)

Cada mês precisa de `mes` no formato `AAAA-MM` (mês sem isso é ignorado). No **mês mais
recente** valem os obrigatórios abaixo. Nos meses anteriores tudo é opcional (há meses
lançados à mão), mas o que vier precisa ter o formato certo.

| Campo | Tipo | Obrigatório | Seções |
|---|---|---|---|
| `meses` | lista | sim | Placar, Movimento, Funil, Conversão por professor, Mix de planos, Receita |
| `mes` | mês | sim | (todas do mês) |
| `alunos` | número | sim | Placar, Movimento, Receita |
| `novos` | número | sim | Placar, Movimento |
| `retornos` | número | sim | Placar, Movimento |
| `cancelamentos` | número | sim | Placar, Movimento |
| `alunosInicio` | número | não | Placar, Movimento |
| `mrr` | número | sim | Placar, Receita |
| `contratos` | número | sim | Receita |
| `inadimplentes` | número | sim | Placar, Receita |
| `valorInad` | número | sim | Placar, Receita |
| `leads` | número | sim | Funil |
| `leads_evo` | número | não | Funil |
| `agendadas` | número | sim | Funil |
| `realizadas` | número | sim | Funil |
| `matriculas` | número | sim | Funil |
| `matriculasExp` | número | não | Funil |
| `invMkt` | número | não | Funil |
| `professores` | lista | sim | Conversão por professor |
| `professores[].nome` | texto | sim | Conversão por professor |
| `professores[].realizadas` | número | sim | Conversão por professor |
| `professores[].fechadas` | número | sim | Conversão por professor |
| `professoresSemana` | lista | não | Conversão por professor |
| `professoresSemana[].nome` | texto | sim, se a lista vier | Conversão por professor |
| `planos` | lista | sim | Mix de planos |
| `planos[].nome` | texto | sim | Mix de planos |
| `planos[].alunos` | número | sim | Mix de planos |
| `planos[].receita` | número | sim | Mix de planos |
| `planos[].vendas` | número | não | Mix de planos |
| `planos[].sem_valor` | número | não | Mix de planos |
| `servicos` | lista | não | Serviços e produtos |
| `produtos` | lista | não | Serviços e produtos |
| `vendas_novas` | número | não por enquanto (vira obrigatório quando a Coleta mandar) | Vendas do mês |
| `vendas_renovacao` | número | não por enquanto (vira obrigatório quando a Coleta mandar) | Vendas do mês |

## Composição da base (`base`)

| Campo | Tipo | Obrigatório |
|---|---|---|
| `base` | objeto | sim |
| `base.cadastrados_ativos` | número | sim |
| `base.alunos_ativos` | número | sim |
| `base.contratos_ativos` | número | sim |
| `base.cadastro_sem_contrato_vigente` | número | sim |
| `base.congelados` | número | não |
| `base.vip_incluidos_na_base` | número | não |
| `base.em_cortesia` | número | não |
| `base.contratos_por_aluno` | número | não |
| `base.alunos_com_mais_de_um_contrato` | número | não |
| `base.renovacoes_sobrepostas` | número | não |
| `detalhe.multiplos_contratos` | lista | não |

## Detalhe (`detalhe`)

`detalhe` é objeto obrigatório. Se faltar, caem juntas: Funil, Coortes, Cancelamento,
Risco, Exame, Pipeline, Grade, Infantil, Folha e Fichas.

| Campo | Tipo | Obrigatório | Seção |
|---|---|---|---|
| `detalhe.experimentais_do_mes` | lista | sim | Funil |
| `detalhe.experimentais_do_mes[].data` | texto | sim | Funil |
| `detalhe.matriculas_sem_experimental` | lista | sim | Funil |
| `detalhe.funil_diagnostico` | objeto | não | Funil |
| `detalhe.funil_diagnostico.no_mes` | objeto | não | Funil |
| `detalhe.funil_45` | objeto | não | Funil |
| `detalhe.funil_45.com_experimental` | lista | não | Funil |
| `detalhe.leads_duplicados` | lista | não | Funil |
| `detalhe.coortes_entrada` | lista | sim | Quem entra, fica? |
| `detalhe.coortes_entrada[].mes` | mês | sim | Quem entra, fica? |
| `detalhe.coortes_entrada[].entraram` | número | sim | Quem entra, fica? |
| `detalhe.coortes_entrada[].sobreviveram` | número | sim | Quem entra, fica? |
| `detalhe.coorte_resumo` | objeto | sim | Quem entra, fica? |
| `detalhe.churn` | objeto | sim | Cancelamento |
| `detalhe.churn.total` | número | sim | Cancelamento |
| `detalhe.churn.serie_mensal` | lista | sim | Cancelamento |
| `detalhe.churn.serie_mensal[].mes` | mês | sim | Cancelamento |
| `detalhe.churn.serie_mensal[].cancelamentos` | número | sim | Cancelamento |
| `detalhe.churn.motivos` | objeto | sim | Cancelamento |
| `detalhe.churn.pior_mes` | objeto | não | Cancelamento |
| `detalhe.churn.por_plano` | lista | não | Cancelamento |
| `detalhe.churn.lista` | lista | não | Cancelamento |
| `detalhe.alunos_em_risco` | objeto | sim | Alunos em risco |
| `detalhe.alunos_em_risco.total` | número | sim | Alunos em risco |
| `detalhe.alunos_em_risco.ativos_avaliados` | número | sim | Alunos em risco |
| `detalhe.alunos_em_risco.lista` | lista | sim | Alunos em risco |
| `detalhe.alunos_em_risco.lista[].nome` | texto | sim | Alunos em risco |
| `detalhe.alunos_em_risco.lista[].dias_sem_treinar` | número | não (null = nunca treinou) | Alunos em risco |
| `detalhe.alunos_em_risco.por_faixa` | objeto | não | Alunos em risco |
| `detalhe.aptos_ao_exame` | objeto | sim | Exame de faixa |
| `detalhe.aptos_ao_exame.total` | número | sim | Exame de faixa |
| `detalhe.aptos_ao_exame.lista` | lista | sim | Exame de faixa |
| `detalhe.aptos_ao_exame.lista[].nome` | texto | sim | Exame de faixa |
| `detalhe.aptos_ao_exame.lista[].aulas` | número | sim | Exame de faixa |
| `detalhe.aptos_ao_exame.chegando` | lista | não | Exame de faixa |
| `detalhe.aptos_ao_exame.valor_exame` | número | não | Exame de faixa |
| `detalhe.pipeline` | objeto | sim | Pipeline |
| `detalhe.pipeline.abertos` | número | sim | Pipeline |
| `detalhe.pipeline.lista` | lista | sim | Pipeline |
| `detalhe.pipeline.lista[].nome` | texto | sim | Pipeline |
| `detalhe.pipeline.lista[].dias` | número | sim | Pipeline |
| `detalhe.pipeline.por_etapa` | objeto | não | Pipeline |
| `detalhe.planos_vendidos` | lista | sim | Mix de planos |
| `detalhe.planos_vendidos[].nome` | texto | sim | Mix de planos |
| `detalhe.planos_vendidos[].novas` | número | sim | Mix de planos |
| `detalhe.planos_vendidos[].renovacoes` | número | sim | Mix de planos |
| `detalhe.vendedores` | lista | não | Conversão por professor |
| `detalhe.vendas_do_mes` | lista | não por enquanto | Vendas do mês |
| `detalhe.vendas_do_mes[].aluno` | texto | sim, se a lista vier | Vendas do mês |
| `detalhe.vendas_do_mes[].plano` | texto | sim, se a lista vier | Vendas do mês |
| `detalhe.vendas_do_mes[].data` | data (AAAA-MM-DD) | sim, se a lista vier | Vendas do mês |
| `detalhe.vendas_do_mes[].tipo` | `nova` ou `renovacao` | sim, se a lista vier | Vendas do mês |
| `detalhe.vendas_do_mes[].observacao` | vazio, `retorno`, `mesmo plano`, `troca de plano` ou `contrato adicional` | não | Vendas do mês |
| `detalhe.vendas_do_mes[].plano_anterior` | texto | não | Vendas do mês |
| `detalhe.aulas_por_professor` | lista | sim | Grade da semana |
| `detalhe.aulas_por_professor[].professor` | texto | sim | Grade da semana |
| `detalhe.aulas_por_professor[].aulas` | número | sim | Grade da semana |
| `detalhe.aulas_por_professor[].presencas` | número | sim | Grade da semana |
| `detalhe.aulas_por_professor[].modalidades` | lista | não | Grade da semana |
| `detalhe.aulas_por_modalidade` | lista | sim | Grade da semana |
| `detalhe.aulas_por_modalidade[].modalidade` | texto | sim | Grade da semana |
| `detalhe.aulas_por_modalidade[].aulas` | número | sim | Grade da semana |
| `detalhe.mapa_grade` | objeto | não | Mapa da grade (só o mapa) |
| `detalhe.mapa_grade.celulas` | lista | sim, se o mapa vier | Mapa da grade |
| `detalhe.mapa_grade.celulas[].dia` | número | sim | Mapa da grade |
| `detalhe.mapa_grade.celulas[].hora` | texto | sim | Mapa da grade |
| `detalhe.mapa_grade.celulas[].turmas` | lista | não | Mapa da grade |
| `detalhe.infantil` | objeto | sim | Turma infantil |
| `detalhe.infantil.ativos` | número | sim | Turma infantil |
| `detalhe.infantil.por_faixa` | objeto | não | Turma infantil |
| `detalhe.folha_do_mes` | lista | sim | Folha, Fichas |
| `detalhe.folha_do_mes[].professor` | texto | sim | Folha, Fichas |
| `detalhe.folha_do_mes[].aulas` | número | sim | Folha, Fichas |
| `detalhe.folha_do_mes[].coletivas` | número | sim | Folha |
| `detalhe.folha_do_mes[].introdutorias` | número | sim | Folha |
| `detalhe.folha_do_mes[].presencas` | número | sim | Folha |
| `detalhe.folha_resumo` | objeto | sim | Fichas |
| `detalhe.sessoes_no_mes` | número | não | Folha |
| `detalhe.avulsos_do_mes` | objeto | não | Folha, Caixa |
| `detalhe.avulsos_do_mes.categorias` | lista | não | Caixa |
| `detalhe.caixa_do_mes` | objeto | não | Caixa |
| `detalhe.servicos_avulsos` | lista | não | Serviços e produtos |
| `detalhe.produtos_vendidos` | lista | não | Serviços e produtos |
| `detalhe.canais_lead` | objeto | não | Qualidade dos dados |

## Outros

| Campo | Tipo | Obrigatório | Seção / o que acontece |
|---|---|---|---|
| `diagnostico` | objeto | não | Folha |
| `diagnostico.dias_de_grade_pedidos` | número | não | Folha |
| `diagnostico.dias_de_grade_lidos` | número | não | Folha |
| `declaracoes` | lista | não | Conferência (criado no Relatório) |
| `declaracoes[].professor` | texto | sim, se a lista vier | Conferência |
| `declaracoes[].periodo` | mês | sim, se a lista vier | Conferência |
| `metas` e `metas.*` | objeto / número | não | Se vier errado, usa a meta padrão |
| `teto`, `horizonte`, `valorAula` | número | não | Se vier errado, usa o valor padrão |
| `cenarios` | objeto | não | Se vier errado, usa os cenários calculados |
| `vendas_historico` | lista | não | Vendas do mês (gráfico dos meses anteriores) |
| `vendas_historico[].mes` | mês | sim, se a lista vier | Vendas do mês |
| `vendas_historico[].novas` | número | sim, se a lista vier | Vendas do mês |
| `vendas_historico[].renovacao` | número | sim, se a lista vier | Vendas do mês |

## Venda nova × renovação (28/09/2026)

Venda é um contrato de plano vendido no mês. Ficam de fora a cobrança automática do
plano recorrente (venda com `idSaleRecurrency`) e o VIP/cortesia (R$ 0). **Nova** é o
primeiro contrato do aluno na escola. **Renovação** é quando o aluno já teve algum
contrato antes, vigente ou vencido. A observação da renovação diz de que tipo ela foi:
`retorno` (sem contrato vigente na data), `mesmo plano`, `troca de plano` (o contrato
anterior terminou) ou `contrato adicional` (o anterior segue ativo).

O número do mês vem de `meses[].vendas_novas`/`vendas_renovacao`. Um mês que não tiver
esses campos busca o número em `vendas_historico`. O histórico fica numa lista à parte
de propósito: gravar um mês antigo só com esses dois campos dentro de `meses[]`
apagaria a base, as entradas e as saídas reconstruídas daquele mês. A seção só aparece
quando algum mês tiver o dado.
Conferências do painel: `vendas_novas` + `vendas_renovacao` precisa dar o total de itens
de `vendas_do_mes`; se não der, aparece um alerta na seção.

## O que o n8n já confere hoje (nó "Validar formato")

Já batem com esta lista: `mes.alunos`, `contratos`, `novos`, `cancelamentos`, `mrr`,
`inadimplentes`, `agendadas`, `realizadas`; as listas `professores`, `planos`,
`servicos`, `produtos`; `base.alunos_ativos`; as listas de `detalhe` (aulas por
professor/modalidade, folha, experimentais, planos vendidos, matrículas sem experimental,
coortes); `churn.serie_mensal`; `folha_resumo`; e os quatro objetos
`alunos_em_risco`, `aptos_ao_exame`, `infantil` e `pipeline`.

**Faltam no n8n** (o painel usa, a Coleta não confere):
`mes.mes` (formato AAAA-MM), `mes.retornos`, `mes.valorInad`, `mes.leads`,
`mes.matriculas`; itens de `professores[]` e `planos[]`;
`base.cadastrados_ativos`, `base.contratos_ativos`, `base.cadastro_sem_contrato_vigente`;
`detalhe.coorte_resumo`, `churn.total`, `churn.motivos`,
`alunos_em_risco.ativos_avaliados`, e os campos dentro dos itens das listas
(`nome`, `aulas`, `dias`, `professor`, `presencas`, `mes` etc.).
`mapa_grade` hoje é só aviso no n8n; no painel, se vier quebrado, só o mapa some.
A separação de vendas ainda não é gerada pela Coleta: `mes.vendas_novas`,
`mes.vendas_renovacao`, `detalhe.vendas_do_mes` e `vendas_historico`.
