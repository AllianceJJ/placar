#!/usr/bin/env bash
# Confere se o n8n gravou o dados.json do Placar na última rodada.
# O Relatório grava segunda 5h (semana) e dia 1º 5h (fechamento). Esta conferência
# roda às 9h nesses dias: se o último commit do dados.json tiver mais de LIMITE_HORAS,
# abre uma issue (avisa por e-mail) e marca a execução como falha.
# Quando o dados.json volta a chegar, fecha a issue aberta.
# Teste local sem mexer no GitHub: AGORA=<epoch> SIMULAR=1 bash conferir-placar.sh
set -euo pipefail

LIMITE_HORAS="${LIMITE_HORAS:-20}"
TITULO="Placar atrasado: o n8n não gravou o dados.json"
agora="${AGORA:-$(date +%s)}"

ultimo=$(git log -1 --format=%ct --until="$agora" -- dados.json)
horas=$(( (agora - ultimo) / 3600 ))
quando=$(TZ=America/Sao_Paulo date -d "@$ultimo" '+%d/%m/%Y às %Hh%M')

gh_(){ if [ -n "${SIMULAR:-}" ]; then echo "[simulado] gh $*" >&2; else gh "$@"; fi; }
aberta=$(gh_ issue list --state open --limit 100 --json number,title \
  --jq "map(select(.title == \"$TITULO\"))[0].number // empty" || true)

if [ "$horas" -le "$LIMITE_HORAS" ]; then
  echo "OK: dados.json gravado em $quando (há ${horas}h)."
  if [ -n "$aberta" ]; then
    gh_ issue close "$aberta" --comment "O dados.json voltou a chegar: gravado em $quando. Fechando o alarme."
  fi
  exit 0
fi

echo "ATRASADO: o último dados.json é de $quando (há ${horas}h)."
if [ -z "$aberta" ]; then
  gh_ issue create --title "$TITULO" --body "O último \`dados.json\` foi gravado em **$quando** (há ${horas} horas).

O Relatório do Placar roda toda segunda e todo dia 1º às 5h. Hoje às 9h ainda não tinha chegado nada novo, então o painel está mostrando a foto antiga.

O que conferir:
1. No n8n (alliancesjc.app.n8n.cloud), as execuções do \"Placar — Relatório\": se rodou e deu erro, ou se nem rodou.
2. Se nada rodou na instância, pode ser o limite de execuções do plano (foi o que aconteceu em 20/10/2026).
3. Depois de resolver, rode o Relatório na mão. Esta issue fecha sozinha na próxima conferência que achar o arquivo em dia."
else
  echo "Já existe a issue #$aberta aberta para este atraso."
fi
exit 1
