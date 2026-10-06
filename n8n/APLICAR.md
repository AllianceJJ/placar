# Correções de 06/10/2026 — como aplicar no n8n

Código testado localmente contra os dados reais da execução de 05/10 (Coleta 19854).
O código atual reproduziu a saída do n8n sem nenhuma diferença antes das mudanças.
Nada disto está no n8n ainda. A Data Table **"Leads vistos"** (`gktn7Z9NzpG7aZEf`) já foi criada, vazia.

Prazo: o item 2 (Relatório) precisa estar publicado **antes da segunda 02/11, 5h**. Senão a
semana daquele dia vira de novo um fechamento de outubro.

## 1. Placar — Coleta e Cálculo (`TlhqxSdMOllJHYQw`)

Trocar o código destes nós pelo arquivo correspondente em `n8n/coleta/`:

| Nó | Arquivo | O que muda |
|---|---|---|
| Agenda dos leads | `Agenda_dos_leads.js` | Completa a paginação pelo header `total` (atrasos: lia 300 de 1.671) |
| Calcular indicadores | `Calcular_indicadores.js` | Novos com contrato ou plano comprado; semana do fechamento pela janela de 60 dias; folha sem aula de hoje/futura e sem falta; `detalhe.novos_do_mes` |
| Complementar indicadores | `Complementar_indicadores.js` | Régua da EVO (`leads_evo`, `leads_convertidos`); pipeline sem "Não deu certo" e sem lead de quem já é aluno; canal de quem converteu; `matriculasExp` só com contrato |
| Validar formato | `Validar_formato.js` | Aviso `TRUNCADO` quando uma lista da EVO vier cortada |

Nós novos e fiação:

1. **Ler leads vistos** — Data Table, operação *Get many rows* (`returnAll`), tabela "Leads vistos".
   Configurações: *Always Output Data* ligado, *Execute Once* ligado, *On Error* = continuar.
   Fica entre **Ler aulas por aluno** e **Complementar indicadores**:
   `Ler aulas por aluno → Ler leads vistos → Complementar indicadores`.
2. **Preparar leads vistos** — Code, código de `Preparar_leads_vistos.js`. Depois de **Validar formato**.
3. **Gravar leads vistos** — Data Table, *Upsert*, tabela "Leads vistos", casando por `idProspect`
   (`= {{ $json.idProspect }}`), colunas mapeadas uma a uma (`idProspect`, `cadastro`, `canal`,
   `nome`, `fone`, `email`, `etapa`, `vistoEm` = `{{ $json.<coluna> }}`). *On Error* = continuar.
4. **Devolver resultado** — Code, *Run Once for All Items*:
   `return [{ json: $('Validar formato').first().json }];`

Fiação final do fim da Coleta:
`Complementar → Mapa da grade → Validar formato → Preparar leads vistos → Gravar leads vistos → Devolver resultado`.
O **Devolver resultado** precisa ser o último nó: é a saída dele que o Relatório recebe.

## 2. Placar — Relatório (`uLpBvyCGdHS8e1RO`)

1. Apagar o gatilho **"Segunda 5h e dia 1o 5h"** e criar dois gatilhos de agenda, ligados ao nó **Configuração**:
   - **Segunda 5h** — semanal, segunda-feira, 5h;
   - **Dia 1o 5h** — mensal, dia 1, 5h.
   Os nomes precisam ser exatamente esses: o "Definir escopo" lê os dois.
2. **Definir escopo** — código de `n8n/relatorio/Definir_escopo.js`.
3. **Validar dados** — código de `n8n/relatorio/Validar_dados.js`.
4. **Gravar historico** — trocar a data (no filtro e na coluna `data`) por
   `{{ ($json.base && $json.base.base_fotografada_em) || $json.geradoEm.slice(0,10) }}`.

## 3. Depois de publicar

- Conferir a execução de segunda 12/10, 5h. A Coleta deve ter cerca de 28 chamadas a mais, das páginas de atraso.
  O tempo deve ficar perto de 2min40, abaixo dos 300s. `validacao.avisos` não deve trazer `TRUNCADO`, e a
  tabela "Leads vistos" deve ganhar cerca de 70 linhas.
- A inadimplência pode **subir** no painel. Se subir, não é piora: é atraso de meados de maio a agosto que a coleta não lia.
