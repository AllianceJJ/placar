# Correções de 06–07/10/2026 no n8n

Código dos nós do Placar que foram alterados nesta revisão, na versão publicada.
Antes de publicar, o código atual da Coleta foi rodado localmente com os dados reais da
execução de 05/10 (Coleta 19854). A saída bateu com a do n8n sem nenhuma diferença; só
então as mudanças foram feitas e testadas da mesma forma. Depois disso, a Coleta foi
testada no próprio n8n com chamadas reais à EVO.

## Placar — Coleta e Cálculo (`TlhqxSdMOllJHYQw`)

| Nó | Arquivo | O que mudou |
|---|---|---|
| Plano de coleta | `coleta/Plano_de_coleta.js` | Contratos lidos do começo da lista: a EVO 2026.10.05.1 passou a respeitar o filtro de status (10.020 → 279 linhas) e a cauda antiga vinha vazia |
| Agenda dos leads | `coleta/Agenda_dos_leads.js` | Completa a paginação pelo header `total` (atrasos: lia 300 de 1.671); se a EVO voltar a ignorar o filtro de contratos, pede a cauda |
| Calcular indicadores | `coleta/Calcular_indicadores.js` | Novos com contrato ou plano comprado; semana do fechamento pela janela de 60 dias; folha até ontem e só aula individual finalizada (lista de não finalizadas); congelados pelo cadastro se o contrato suspenso não vier; `detalhe.novos_do_mes` |
| Complementar indicadores | `coleta/Complementar_indicadores.js` | Régua da EVO (`leads_evo`, `leads_convertidos`); pipeline sem "Não deu certo" e sem lead de quem já é aluno; canal de quem converteu; `matriculasExp` só com contrato; mesma régua na semana |
| Validar formato | `coleta/Validar_formato.js` | Aviso `TRUNCADO` quando uma lista da EVO vier cortada |
| Preparar leads vistos (novo) | `coleta/Preparar_leads_vistos.js` | Monta as linhas da tabela "Leads vistos" |

Nós novos sem código próprio:
- **Ler leads vistos**: lê a tabela "Leads vistos" (`gktn7Z9NzpG7aZEf`) entre "Ler aulas por aluno" e "Complementar".
- **Gravar leads vistos**: grava na mesma tabela, por *upsert* em `idProspect`.
- **Devolver resultado**: devolve ao Relatório a saída do "Validar formato". Precisa ser o último nó.

## Placar — Relatório (`uLpBvyCGdHS8e1RO`)

| Nó | Arquivo | O que mudou |
|---|---|---|
| Segunda 5h / Dia 1o 5h | — | Dois gatilhos no lugar de um. O escopo vem do gatilho, não do dia do mês |
| Definir escopo | `relatorio/Definir_escopo.js` | Segunda = semana, dia 1º = fechamento; se o dia 1º cair na segunda, só o mensal roda |
| Validar dados | `relatorio/Validar_dados.js` | Manda para o WhatsApp o aviso de lista cortada |
| Gravar historico | — | A data da linha passa a ser `base_fotografada_em` (no fechamento, o último dia do mês) |

## O que conferir na segunda 12/10, às 5h

- A Coleta deve terminar abaixo dos 300s; o teste de 07/10 serve de referência de tempo.
- `validacao.avisos` deve vir sem `TRUNCADO`.
- A tabela "Leads vistos" deve crescer com os leads da semana.
- A inadimplência pode subir no painel. Não é piora: é atraso de meados de maio a agosto que a coleta não lia.
- Primeira rodada com venda nova × renovação: `mes.vendas_novas` + `mes.vendas_renovacao` precisa dar o tamanho de `detalhe.vendas_do_mes`, e `diagnostico.vendas_sem_historico` deve vir 0.

## 08/10/2026 — venda nova × renovação (publicado)

| Workflow | Nó | Arquivo | O que mudou |
|---|---|---|---|
| Coleta | Agenda dos leads | `coleta/Agenda_dos_leads.js` | Pede `/v1/members/{id}` (rótulo `hist:`) de cada comprador de plano do mês, até 120; entra no orçamento de tempo |
| Coleta | Vendas do mes (novo) | `coleta/Vendas_do_mes.js` | Entre "Complementar indicadores" e "Mapa da grade". Gera `mes.vendas_novas`, `mes.vendas_renovacao` e `detalhe.vendas_do_mes`; erro vira `detalhe.vendas_erro`, sem derrubar o Placar |
| Coleta | Validar formato | `coleta/Validar_formato.js` | Avisos de vendas ausentes, lista que não bate e venda sem histórico |
| Relatório | Validar dados | `relatorio/Validar_dados.js` | Confere as vendas (opcional) e manda no WhatsApp se a lista não bater |

Teste: executor offline com as vendas reais de setembro (32 vendas, 18 novas e 14 renovações; o resto da Coleta saiu idêntico) e teste real em 08/10 às 22h44 (2min28, sem avisos, outubro com 7 vendas: 4 + 3).
