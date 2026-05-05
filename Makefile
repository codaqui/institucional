# =============================================================================
# Codaqui — Makefile
# Controla frontend (Docusaurus), backend (NestJS) e infra (Podman Compose).
#
# Uso rápido:
#   make setup        → prepara o ambiente pela primeira vez
#   make up           → sobe todos os serviços (captura secret do Stripe)
#   make down         → para tudo
#
# Execute `make help` para ver todos os comandos disponíveis.
# =============================================================================

# -----------------------------------------------------------------------------
# Configuração
# -----------------------------------------------------------------------------
COMPOSE_FILE     := compose.yaml
COMPOSE_PROD     := compose.prod.yaml
BACKEND_DIR      := backend
ENV_FILE         := .env
ENV_EXAMPLE      := .env.example

# Load .env into make's environment so host targets see variables (if file exists)
ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export
endif


# Cores para output do terminal
RESET  := \033[0m
BOLD   := \033[1m
GREEN  := \033[32m
YELLOW := \033[33m
CYAN   := \033[36m
RED    := \033[31m

# Torna todos os targets .PHONY (sem arquivos gerados com o mesmo nome)
.PHONY: help \
        setup env-check \
        up up-build down restart ps logs \
        db-up db-shell db-wait db-restore-prod \
        stripe-secret \
        migration-generate migration-run migration-revert migration-show \
        backend-start backend-build backend-test backend-lint \
        frontend-start frontend-build frontend-typecheck frontend-serve \
        sync sync-events sync-events-full sync-social sync-analytics \
        worker-dev-tisocial worker-deploy-tisocial \
        clean clean-volumes

# Target padrão
.DEFAULT_GOAL := help

# =============================================================================
##@ 📋 Ajuda
# =============================================================================

help: ## Exibe esta mensagem de ajuda
	@printf "\n$(BOLD)Codaqui — Makefile$(RESET)\n\n"
	@awk 'BEGIN {FS = ":.*##"; section=""} \
	    /^##@/ { \
	        gsub(/^##@ /, "", $$0); \
	        printf "\n$(BOLD)%s$(RESET)\n", $$0; next \
	    } \
	    /^[a-zA-Z_-]+:.*?##/ { \
	        printf "  $(CYAN)%-28s$(RESET) %s\n", $$1, $$2 \
	    }' $(MAKEFILE_LIST)
	@printf "\n"

# =============================================================================
##@ 🔧 Setup inicial
# =============================================================================

setup: ## Prepara o ambiente: cria .env e instala dependências
	@if [ ! -f $(ENV_FILE) ]; then \
	    cp $(ENV_EXAMPLE) $(ENV_FILE); \
	    printf "$(YELLOW)⚠  .env criado a partir de .env.example — preencha os segredos antes de subir.$(RESET)\n"; \
	else \
	    printf "$(GREEN)✔  .env já existe.$(RESET)\n"; \
	fi
	@printf "$(CYAN)→  Instalando dependências do frontend...$(RESET)\n"
	npm install
	@printf "$(CYAN)→  Instalando dependências do backend...$(RESET)\n"
	cd $(BACKEND_DIR) && npm install
	@printf "$(GREEN)✔  Setup concluído. Edite o .env e execute: make up$(RESET)\n"

env-check: ## Valida se o .env existe (usado internamente por outros targets)
	@if [ ! -f $(ENV_FILE) ]; then \
	    printf "$(RED)✖  Arquivo .env não encontrado. Execute: make setup$(RESET)\n"; \
	    exit 1; \
	fi

# =============================================================================
##@ 🐳 Infra (Podman Compose)
# =============================================================================

up: env-check ## Sobe todos os serviços e captura o STRIPE_WEBHOOK_SECRET automaticamente
	@printf "$(CYAN)→  Iniciando stripe-cli para capturar o webhook secret...$(RESET)\n"
	@podman compose -f $(COMPOSE_FILE) up stripe-cli -d 2>/dev/null || true
	@sleep 6
	@WEBHOOK_SECRET=$$(podman logs codaqui_stripe_cli 2>&1 | grep -oE 'whsec_[A-Za-z0-9]+' | tail -1); \
	if [ -n "$$WEBHOOK_SECRET" ]; then \
	    sed -i.bak "s|STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=$$WEBHOOK_SECRET|" $(ENV_FILE) && rm -f $(ENV_FILE).bak; \
	    printf "$(GREEN)✔  STRIPE_WEBHOOK_SECRET atualizado: $$WEBHOOK_SECRET$(RESET)\n"; \
	else \
	    printf "$(YELLOW)⚠  Não foi possível capturar o webhook secret (STRIPE_SECRET_KEY ausente?).$(RESET)\n"; \
	fi
	@printf "$(CYAN)→  Subindo todos os serviços...$(RESET)\n"
	podman compose -f $(COMPOSE_FILE) up

up-build: env-check ## Reconstrói as imagens e sobe (equivale ao --no-cache)
	podman compose -f $(COMPOSE_FILE) build --no-cache
	$(MAKE) up

down: ## Para e remove todos os containers
	podman compose -f $(COMPOSE_FILE) down

restart: ## Reinicia todos os containers (ou SERVICE=backend para um específico)
	podman compose -f $(COMPOSE_FILE) restart $(SERVICE)

ps: ## Lista o status dos containers
	podman compose -f $(COMPOSE_FILE) ps

logs: ## Acompanha os logs em tempo real (ou SERVICE=backend para um específico)
	podman compose -f $(COMPOSE_FILE) logs -f $(SERVICE)

stripe-secret: ## Exibe o STRIPE_WEBHOOK_SECRET atual nos logs do stripe-cli
	@WEBHOOK_SECRET=$$(podman logs codaqui_stripe_cli 2>&1 | grep -oE 'whsec_[A-Za-z0-9]+' | tail -1); \
	if [ -n "$$WEBHOOK_SECRET" ]; then \
	    printf "$(GREEN)STRIPE_WEBHOOK_SECRET=$$WEBHOOK_SECRET$(RESET)\n"; \
	else \
	    printf "$(YELLOW)⚠  stripe-cli não está rodando ou ainda não gerou o secret.$(RESET)\n"; \
	fi

# =============================================================================
##@ 🗄️  Banco de dados
# =============================================================================

db-up: env-check ## Sobe apenas o PostgreSQL (útil para dev sem todos os serviços)
	podman compose -f $(COMPOSE_FILE) up postgres -d
	$(MAKE) db-wait

db-wait: ## Aguarda o PostgreSQL estar pronto para aceitar conexões
	@printf "$(CYAN)→  Aguardando PostgreSQL...$(RESET)\n"
	@for i in $$(seq 1 20); do \
	    podman compose -f $(COMPOSE_FILE) exec postgres pg_isready -U $${DB_USER:-codaqui} -q 2>/dev/null && \
	    printf "$(GREEN)✔  PostgreSQL pronto.$(RESET)\n" && exit 0; \
	    sleep 2; \
	done; \
	printf "$(RED)✖  PostgreSQL não respondeu a tempo.$(RESET)\n"; exit 1

db-shell: ## Abre um shell psql no container do PostgreSQL
	podman compose -f $(COMPOSE_FILE) exec postgres psql -U $${DB_USER:-codaqui} $${DB_NAME:-codaqui_db}

db-restore-prod: env-check ## Restaura dump de produção (pg_dump/*.dmp); use DUMP=path para específico
	@./scripts/db-restore-prod.sh

# =============================================================================
##@ 🔄 Migrations (TypeORM — backend)
# =============================================================================
# As migrations usam o data-source em backend/src/data-source.ts.
# Certifique-se de que o PostgreSQL está rodando antes de executar.
# O nome é gerado automaticamente: NNN_YYYYMMDD (sequência + data de hoje).

migration-generate: ## Gera uma nova migration com nome automático (Migration_NNN_YYYYMMDD)
	@LAST=$$(find $(BACKEND_DIR)/src/migrations -maxdepth 1 -name "*.ts" -exec basename {} .ts \; 2>/dev/null \
	    | grep -oE 'Migration[0-9]+_' | grep -oE '[0-9]+' | sort -n | tail -1); \
	NEXT=$$(printf "%03d" $$(( $${LAST:-0} + 1 ))); \
	DATE=$$(date +%Y%m%d); \
	cd $(BACKEND_DIR) && npm run migration:generate -- "src/migrations/Migration$${NEXT}_$${DATE}"

migration-run: ## Executa todas as migrations pendentes
	cd $(BACKEND_DIR) && npm run migration:run

migration-revert: ## Reverte a última migration aplicada
	cd $(BACKEND_DIR) && npm run migration:revert

migration-show: ## Lista migrations e seus status (aplicada / pendente)
	cd $(BACKEND_DIR) && npx typeorm-ts-node-commonjs migration:show -d src/data-source.ts

# =============================================================================
##@ ⚙️  Backend (NestJS)
# =============================================================================

backend-start: ## Inicia o backend em modo watch (sem containers)
	@printf "$(CYAN)→  Certifique-se de que o PostgreSQL está rodando: make db-up$(RESET)\n"
	cd $(BACKEND_DIR) && npm run start:dev

backend-build: ## Compila o backend TypeScript → dist/
	cd $(BACKEND_DIR) && npm run build

backend-test: ## Executa os testes unitários do backend
	cd $(BACKEND_DIR) && npm test

backend-lint: ## Executa o linter e auto-corrige o backend
	cd $(BACKEND_DIR) && npm run lint

# =============================================================================
##@ 🌐 Frontend (Docusaurus)
# =============================================================================

frontend-start: ## Inicia o servidor de desenvolvimento do Docusaurus
	npm start

frontend-build: ## Gera o build de produção do Docusaurus (igual ao CI)
	npm run build

frontend-typecheck: ## Valida TypeScript do frontend (exclui /backend)
	npm run typecheck

frontend-serve: ## Serve o build estático localmente para homologação
	npm run serve

# =============================================================================
##@ 🤝 TI Social
# =============================================================================

tisocial-start: ## Inicia o servidor de desenvolvimento do TI Social (Porta 3005)
	npm run tisocial:start

tisocial-build: ## Gera o build de produção do TI Social
	npm run tisocial:build

# =============================================================================
##@ 📊 Sync de dados estáticos
# =============================================================================
# Requer DISCORD_BOT_TOKEN no .env para eventos do Discord.
# Sem o token, os scripts preservam os snapshots existentes.

sync: ## Sincroniza eventos, membros e analytics (execução completa)
	npm run sync

sync-events: ## Sincroniza eventos (Discord + Meetup) → static/events/
	npm run sync:events

sync-events-full: ## Re-pagina todos os eventos passados (mais lento)
	npm run sync:events:full

sync-social: ## Sincroniza contagem de membros/seguidores → static/social-stats/
	npm run sync:social

sync-analytics: ## Sincroniza analytics → static/analytics/
	npm run sync:analytics

# =============================================================================
##@ 🌍 Workers (Cloudflare) — domínios próprios das comunidades
# =============================================================================
# Cada comunidade com domínio próprio tem `workers/<slug>/wrangler*.toml`.
# Código do Worker é compartilhado em `workers/shared/index.js`.
# Ver workers/README.md e MULTISITE_PLAN.md §6.

worker-dev-tisocial: ## Sobe o Worker da T.I. Social local em http://tisocial.localhost:8787 (precisa de `make up-build` rodando)
	npm run worker:dev:tisocial

worker-deploy-tisocial: ## Deploy do Worker da T.I. Social em produção (route tisocial.org.br/*)
	npm run worker:deploy:tisocial

# =============================================================================
##@ 🧹 Limpeza
# =============================================================================

clean: ## Remove containers e imagens órfãs (preserva volumes de dados)
	podman compose -f $(COMPOSE_FILE) down --remove-orphans
	podman image prune -f

clean-volumes: ## ⚠ DESTRUTIVO — remove containers, imagens E volumes (apaga dados do banco)
	@printf "$(RED)$(BOLD)ATENÇÃO: isso apagará todos os dados do PostgreSQL!$(RESET)\n"
	@printf "Pressione Ctrl+C para cancelar ou Enter para continuar... "; read _
	podman compose -f $(COMPOSE_FILE) down --volumes --remove-orphans
	podman volume prune -f
