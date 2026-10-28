# =============================================================================
# Codaqui — Makefile
# Controla o app Astro (frontend/ — site oficial pós-Fase 0.6), backend (NestJS)
# e infra (Podman Compose).
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
ASTRO_DIR        := frontend
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
        astro-install astro-dev astro-build astro-check astro-test astro-preview \
        astro-verify astro-verify-tenants astro-lighthouse \
        sync sync-events sync-events-full sync-social sync-analytics \
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
	    DB_PASS=$$(openssl rand -hex 16 || echo "") && [ -n "$$DB_PASS" ] || { echo "Erro ao gerar DB_PASSWORD com openssl"; exit 1; }; \
	    JWT=$$(openssl rand -hex 64 || echo "") && [ -n "$$JWT" ] || { echo "Erro ao gerar JWT_SECRET com openssl"; exit 1; }; \
	    sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=$$DB_PASS|" $(ENV_FILE); \
	    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$$JWT|" $(ENV_FILE); \
	    rm -f $(ENV_FILE).bak; \
	    printf "$(YELLOW)⚠  .env criado a partir de .env.example.$(RESET)\n"; \
	    printf "$(GREEN)✔  DB_PASSWORD e JWT_SECRET gerados automaticamente.$(RESET)\n"; \
	else \
	    printf "$(GREEN)✔  .env já existe.$(RESET)\n"; \
	fi
	@printf "$(CYAN)→  Instalando dependências da raiz (scripts de sync — leve, só devDeps)...$(RESET)\n"
	npm install
	@printf "$(CYAN)→  Instalando dependências do backend...$(RESET)\n"
	cd $(BACKEND_DIR) && npm install
	@printf "$(CYAN)→  Instalando dependências do app Astro (frontend/)...$(RESET)\n"
	cd $(ASTRO_DIR) && npm install
	@if which mkcert > /dev/null; then \
	    printf "$(CYAN)→  mkcert encontrado. Tentando configurar HTTPS automaticamente...$(RESET)\n"; \
	    $(MAKE) setup-https; \
	else \
	    printf "$(YELLOW)⚠  mkcert não encontrado. O ambiente rodará em HTTP.\n    Para HTTPS local, instale mkcert e rode: make setup-https$(RESET)\n"; \
	fi
	@printf "\n$(YELLOW)========================================================================$(RESET)\n"
	@printf "$(YELLOW)⚠  IMPORTANTE: Não se esqueça de preencher os segredos no arquivo .env:$(RESET)\n"
	@printf "$(YELLOW)   - STRIPE_SECRET_KEY$(RESET)\n"
	@printf "$(YELLOW)   - DISCORD_BOT_TOKEN$(RESET)\n"
	@printf "$(YELLOW)   - GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET$(RESET)\n"
	@printf "$(YELLOW)========================================================================$(RESET)\n"
	@printf "$(GREEN)✔  Setup concluído. Preencha os segredos e execute: make up$(RESET)\n"

env-check: ## Valida se o .env existe (usado internamente por outros targets)
	@if [ ! -f $(ENV_FILE) ]; then \
	    printf "$(RED)✖  Arquivo .env não encontrado. Execute: make setup$(RESET)\n"; \
	    exit 1; \
	fi
	@if grep -q "STRIPE_SECRET_KEY=sk_test_COLE_SUA_CHAVE_AQUI" $(ENV_FILE) || grep -qE "^STRIPE_SECRET_KEY=$$" $(ENV_FILE) || ! grep -q "STRIPE_SECRET_KEY" $(ENV_FILE); then \
	    printf "$(YELLOW)⚠  STRIPE_SECRET_KEY ausente ou com valor padrão. O serviço stripe-cli irá falhar/não subir corretamente.$(RESET)\n"; \
	fi
	@if grep -q "DISCORD_BOT_TOKEN=COLE_SEU_TOKEN_AQUI" $(ENV_FILE) || grep -qE "^DISCORD_BOT_TOKEN=$$" $(ENV_FILE) || ! grep -q "DISCORD_BOT_TOKEN" $(ENV_FILE); then \
	    printf "$(YELLOW)⚠  DISCORD_BOT_TOKEN ausente. O sync de eventos do Discord usará snapshots.$(RESET)\n"; \
	fi
	@if grep -q "GITHUB_CLIENT_ID=COLE_AQUI" $(ENV_FILE) || grep -qE "^GITHUB_CLIENT_ID=$$" $(ENV_FILE) || grep -q "GITHUB_CLIENT_SECRET=COLE_AQUI" $(ENV_FILE) || grep -qE "^GITHUB_CLIENT_SECRET=$$" $(ENV_FILE); then \
	    printf "$(YELLOW)⚠  GITHUB_CLIENT_ID/SECRET não configurados ou com valores padrão. Autenticação via GitHub não funcionará.$(RESET)\n"; \
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

up-build: env-check ## Reconstrói as imagens e sobe usando cache local
	podman compose -f $(COMPOSE_FILE) build
	$(MAKE) up

up-force-build: env-check ## Reconstrói as imagens e sobe SEM usar o cache (--no-cache)
	podman compose -f $(COMPOSE_FILE) build --no-cache
	$(MAKE) up

setup-https: ## Gera certificados locais confiáveis via mkcert (HTTPS)
	@printf "$(CYAN)→  Verificando mkcert...$(RESET)\n"
	@which mkcert > /dev/null || (printf "$(RED)✖  mkcert não instalado. No macOS: brew install mkcert nss$(RESET)\n" && exit 1)
	@mkcert -install
	@mkdir -p .certs
	@mkcert -key-file .certs/localhost-key.pem -cert-file .certs/localhost.pem "localhost" "*.localhost" "127.0.0.1" "::1"
	@sed -i.bak "s|^HTTPS=.*|HTTPS=true|" $(ENV_FILE)
	@rm -f $(ENV_FILE).bak
	@printf "$(GREEN)✔  Certificados gerados em .certs/ e HTTPS ativado no .env.$(RESET)\n"

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
##@ 🚀 Frontend (Astro) — app oficial em frontend/ (site + tenants)
# =============================================================================

astro-install: ## Instala dependências do app Astro
	cd $(ASTRO_DIR) && npm install

astro-dev: ## Inicia o dev server do Astro em http://localhost:4321
	cd $(ASTRO_DIR) && npm run dev

astro-build: ## Gera o build estático do Astro (copia snapshots antes, via prebuild)
	cd $(ASTRO_DIR) && npm run build

astro-check: ## Valida tipos dos arquivos .astro (astro check)
	cd $(ASTRO_DIR) && npm run check

astro-test: ## Roda os testes do app Astro (vitest)
	cd $(ASTRO_DIR) && npm run test

astro-preview: ## Serve o build do Astro em http://localhost:4321 (homologação)
	cd $(ASTRO_DIR) && npm run preview

astro-verify: ## Verificação completa do app Astro: build + tipos + testes + smoke + gate de paridade de URLs
	@printf "$(CYAN)→  Build + typecheck + testes do Astro...$(RESET)\n"
	cd $(ASTRO_DIR) && npm run build && npm run check && npm run test
	@printf "$(CYAN)→  Type-check da Pages Function (tsconfig próprio, fora do astro check)...$(RESET)\n"
	cd $(ASTRO_DIR) && npx tsc -p functions/tsconfig.json
	@printf "$(CYAN)→  Smoke do build (dist/)...$(RESET)\n"
	@test -f $(ASTRO_DIR)/dist/index.html && printf "$(GREEN)✔  homepage gerada$(RESET)\n"
	@grep -q "Democratizando comunidades" $(ASTRO_DIR)/dist/index.html && printf "$(GREEN)✔  homepage com conteúdo real (tagline)$(RESET)\n"
	@grep -q "data-theme" $(ASTRO_DIR)/dist/index.html && printf "$(GREEN)✔  script anti-FOUC de tema presente$(RESET)\n"
	@N=$$(find $(ASTRO_DIR)/dist/eventos -name index.html 2>/dev/null | wc -l | tr -d ' '); \
	    [ "$$N" -gt 0 ] && printf "$(GREEN)✔  %s páginas de eventos geradas$(RESET)\n" "$$N" || { printf "$(RED)✖  nenhuma página de evento gerada$(RESET)\n"; exit 1; }
	@test -f $(ASTRO_DIR)/dist/events/index.json && printf "$(GREEN)✔  snapshot de eventos servido em /events/index.json$(RESET)\n"
	@test -f $(ASTRO_DIR)/dist/admin/eventos/index.html && printf "$(GREEN)✔  /admin/eventos gerada$(RESET)\n"
	@test -f $(ASTRO_DIR)/dist/auth/callback/index.html && printf "$(GREEN)✔  /auth/callback gerada$(RESET)\n"
	@printf "$(CYAN)→  Gate de paridade de URLs públicas vs referência versionada (url-reference.json)...$(RESET)\n"
	node $(ASTRO_DIR)/scripts/diff-urls.mjs
	@printf "$(GREEN)✔  App Astro verificado. Suba com: make astro-preview$(RESET)\n"

# Tenants do app Astro (Fase 0.5) — fonte única em frontend/tenants.config.mjs.
# codaqui não é TENANT: é o build sem a env (srcDir padrão ./src).
ASTRO_TENANTS := $(shell node --input-type=module -e "import('./$(ASTRO_DIR)/tenants.config.mjs').then((m) => console.log(m.TENANTS.map((t) => t.tenant).join(' ')))" 2>/dev/null)

astro-verify-tenants: ## Verificação dos builds multi-tenant: 4 builds (codaqui + 3 tenants) + gate de allow-list de URLs por tenant
	@if [ -z "$(ASTRO_TENANTS)" ]; then \
	    printf "$(RED)✖  Não foi possível ler a lista de tenants em $(ASTRO_DIR)/tenants.config.mjs$(RESET)\n"; \
	    exit 1; \
	fi
	@for t in codaqui $(ASTRO_TENANTS); do \
	    if [ "$$t" = "codaqui" ]; then \
	        printf "$(CYAN)→  Build codaqui (sem TENANT)...$(RESET)\n"; \
	        (cd $(ASTRO_DIR) && env -u TENANT npm run build) || exit 1; \
	    else \
	        printf "$(CYAN)→  Build tenant $$t + gate tenant-urls...$(RESET)\n"; \
	        (cd $(ASTRO_DIR) && TENANT=$$t npm run build && node scripts/tenant-urls.mjs dist $$t) || exit 1; \
	    fi; \
	done
	@printf "$(GREEN)✔  Builds multi-tenant verificados (codaqui + $(ASTRO_TENANTS))$(RESET)\n"
	@printf "$(YELLOW)ℹ  astro check NÃO roda em modo tenant (62 erros pré-existentes em páginas codaqui — R7). Gate de tenant = build + tenant-urls; codaqui completo em make astro-verify$(RESET)\n"

astro-lighthouse: astro-build ## Lighthouse mobile (/, evento, /admin/eventos, /blog, um post, /trilhas, insights, apoiar, design-system) — requer Chrome
	@cd $(ASTRO_DIR) && npm run preview > /tmp/codaqui-astro-preview.log 2>&1 & \
	    PREVIEW_PID=$$!; \
	    sleep 4; \
	    EVENT=$$(find $(ASTRO_DIR)/dist/eventos -name index.html | head -1 | sed "s|^$(ASTRO_DIR)/dist||;s|/index.html$$||"); \
	    for PAGE in "/" "$$EVENT" "/admin/eventos" "/blog" "/blog/2024/07/22/devparana-e-codaqui-unidos-pela-comunidade" "/trilhas/intro" "/trilhas/python/page-1" "/sobre/insights" "/participe/apoiar" "/design-system"; do \
	        printf "$(CYAN)→  Lighthouse: $$PAGE$(RESET)\n"; \
	        npx --yes lighthouse "http://localhost:4321$$PAGE" --quiet \
	            --chrome-flags="--headless" --form-factor=mobile --screenEmulation.mobile \
	            --output=json --output-path=stdout 2>/dev/null \
	            | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const c=JSON.parse(d).categories;console.log('   Perf:',Math.round(c.performance.score*100),'| A11y:',Math.round(c.accessibility.score*100),'| BP:',Math.round(c['best-practices'].score*100),'| SEO:',Math.round(c.seo.score*100))})" \
	            || printf "$(RED)   ✖  falha na medição de $$PAGE$(RESET)\n"; \
	    done; \
	    kill $$PREVIEW_PID 2>/dev/null || true

# =============================================================================
##@ 📊 Sync de dados estáticos
# =============================================================================
# Requer DISCORD_BOT_TOKEN no .env para eventos do Discord.
# Sem o token, os scripts preservam os snapshots existentes.

sync: ## Sincroniza eventos, membros e analytics (execução completa)
	npm run sync

sync-events: ## Sincroniza eventos (Discord + Meetup + internal) → static/events/
	# INTERNAL_EVENTS_API_URL aponta para o backend dev: a fonte internal:codaqui
	# (eventos próprios publicados no Postgres) é resolvida via GET /events/public/managed.
	# Sem o backend no ar, o script cai no último snapshot em disco (fallback normal).
	INTERNAL_EVENTS_API_URL=http://localhost:3001 node scripts/sync-events.mjs

sync-events-full: ## Re-pagina todos os eventos passados (mais lento)
	npm run sync:events:full

sync-social: ## Sincroniza contagem de membros/seguidores → static/social-stats/
	npm run sync:social

sync-analytics: ## Sincroniza analytics → static/analytics/
	npm run sync:analytics

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
