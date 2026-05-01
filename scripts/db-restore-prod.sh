#!/usr/bin/env bash
# =============================================================================
# scripts/db-restore-prod.sh
#
# Restaura um dump de produção no PostgreSQL local (container codaqui_postgres).
#
# Uso:
#   make db-restore-prod                       # usa o dump mais recente em pg_dump/
#   make db-restore-prod DUMP=pg_dump/foo.dmp  # dump específico
#
# Estratégia:
#   1. Localiza o dump (.dmp em formato custom, gerado via pg_dump -F c)
#   2. Recria o schema public (drop cascade + recreate) para estado limpo
#   3. Restaura via pg_restore --no-owner --no-acl
#   4. Imprime resumo (membros, transações, contas)
#
# Importante:
#   - Após restaurar, FAÇA LOGOUT E LOGIN no frontend. Seu UUID de membro
#     muda (o login OAuth te encontra por githubId e gera um JWT novo).
#   - Não toca em pgdata diretamente — só executa SQL via container.
#   - Idempotente: pode rodar múltiplas vezes sem problemas.
# =============================================================================

set -euo pipefail

# Cores
RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
YELLOW='\033[33m'
CYAN='\033[36m'
RED='\033[31m'

cd "$(dirname "$0")/.."

# ─── 1. Carrega .env ─────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  printf "${RED}✖  .env não encontrado. Execute: make setup${RESET}\n"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env; set +a

DB_USER="${DB_USER:-codaqui}"
DB_NAME="${DB_NAME:-codaqui_db}"
CONTAINER="codaqui_postgres"

# ─── 2. Localiza o dump ──────────────────────────────────────────────────────
DUMP_SOURCE=""
DUMP_COUNT=0
DUMP_LIST=()

if [[ -n "${DUMP:-}" ]]; then
  DUMP_FILE="$DUMP"
  DUMP_SOURCE="manual (DUMP=)"
else
  while IFS= read -r line; do
    DUMP_LIST+=("$line")
  done < <(ls -1t pg_dump/*.dmp 2>/dev/null || true)
  DUMP_COUNT="${#DUMP_LIST[@]}"
  if [[ "$DUMP_COUNT" -eq 0 ]]; then
    DUMP_FILE=""
  elif [[ "$DUMP_COUNT" -eq 1 ]]; then
    DUMP_FILE="${DUMP_LIST[0]}"
    DUMP_SOURCE="auto (único dump em pg_dump/)"
  else
    DUMP_FILE="${DUMP_LIST[0]}"
    DUMP_SOURCE="auto (mais recente de ${DUMP_COUNT} dumps em pg_dump/)"
  fi
fi

if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  printf "${RED}✖  Nenhum dump encontrado em pg_dump/*.dmp${RESET}\n"
  printf "    Coloque o arquivo .dmp em pg_dump/ ou use: make db-restore-prod DUMP=caminho/para.dmp\n"
  exit 1
fi

DUMP_BASENAME="$(basename "$DUMP_FILE")"
DUMP_SIZE="$(du -h "$DUMP_FILE" | cut -f1)"

printf "\n${BOLD}🗄  Restauração de dump de produção${RESET}\n"
printf "${CYAN}  Dump:${RESET}      %s (%s) — %s\n" "$DUMP_BASENAME" "$DUMP_SIZE" "$DUMP_SOURCE"
printf "${CYAN}  Container:${RESET} %s\n" "$CONTAINER"
printf "${CYAN}  Database:${RESET}  %s\n" "$DB_NAME"
printf "${CYAN}  DB user:${RESET}   %s\n\n" "$DB_USER"

# Se houver múltiplos dumps, lista os outros para referência
if [[ "$DUMP_COUNT" -gt 1 ]]; then
  printf "${YELLOW}  Outros dumps disponíveis (use DUMP=path para escolher):${RESET}\n"
  for ((i = 1; i < DUMP_COUNT; i++)); do
    printf "    - %s\n" "${DUMP_LIST[i]}"
  done
  printf "\n"
fi

# ─── 3. Verifica que o container está up ─────────────────────────────────────
if ! podman ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  printf "${RED}✖  Container '${CONTAINER}' não está rodando. Execute: make db-up${RESET}\n"
  exit 1
fi

# ─── 4. Confirmação ───────────────────────────────────────────────────────────
printf "${YELLOW}${BOLD}⚠  Isso vai APAGAR todos os dados atuais do schema public.${RESET}\n"
printf "    Pressione ${BOLD}Enter${RESET} para continuar ou ${BOLD}Ctrl+C${RESET} para cancelar... "
read -r _

# ─── 5. Drop & recreate public schema ─────────────────────────────────────────
printf "\n${CYAN}→  Recriando schema public (estado limpo)...${RESET}\n"
podman exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

# ─── 6. Copia o dump para o container e restaura ──────────────────────────────
printf "${CYAN}→  Copiando dump para o container...${RESET}\n"
podman cp "$DUMP_FILE" "${CONTAINER}:/tmp/restore.dmp"

printf "${CYAN}→  Restaurando (pg_restore)...${RESET}\n"
# --no-owner / --no-acl: ignora roles de produção
# --if-exists --clean: limpa antes (extra-safe; já dropamos o schema mas garante objetos não-schema)
# -j 2: paralelismo modesto
if ! podman exec -i "$CONTAINER" pg_restore \
    --no-owner --no-acl \
    --if-exists --clean \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -j 2 \
    /tmp/restore.dmp 2>&1 | tee /tmp/codaqui-pg-restore.log; then
  printf "${YELLOW}⚠  pg_restore reportou warnings. Veja /tmp/codaqui-pg-restore.log no container.${RESET}\n"
fi

podman exec -i "$CONTAINER" rm -f /tmp/restore.dmp

# ─── 7. Resumo do estado restaurado ───────────────────────────────────────────
printf "\n${CYAN}→  Estado pós-restauração:${RESET}\n"
podman exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F ' | ' <<'SQL' | column -t -s '|'
  SELECT 'members'        AS tabela, COUNT(*)::text AS total FROM "members"
  UNION ALL SELECT 'accounts',     COUNT(*)::text FROM "accounts"
  UNION ALL SELECT 'transactions', COUNT(*)::text FROM "transactions"
  UNION ALL SELECT 'expenses',     COUNT(*)::text FROM "expenses"
  UNION ALL SELECT 'audit_logs',   COUNT(*)::text FROM "audit_logs";
SQL

# ─── 8. Próximos passos ───────────────────────────────────────────────────────
cat <<EOF

${BOLD}${GREEN}✔  Restauração concluída.${RESET}

${BOLD}Próximos passos:${RESET}
  1. ${CYAN}make migration-show${RESET}          # confere se há migrations pendentes
  2. ${CYAN}make migration-run${RESET}           # aplica patches de schema (se houver)
  3. No frontend: ${BOLD}faça logout e login${RESET} novamente
     - Seu memberId UUID mudou; o JWT no localStorage está obsoleto
     - O OAuth te encontra por githubId e cria um JWT novo automaticamente

EOF
