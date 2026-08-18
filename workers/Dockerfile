# Dockerfile para os Cloudflare Workers das comunidades.
#
# Resolve o problema de arquitetura nativa do workerd: instalamos as
# dependências dentro do container Linux, em vez de montar node_modules
# do host (que pode ter binários do macOS).
#
# Cada comunidade reusa esta mesma imagem; o wrangler.toml específico e
# a porta são passados via compose.

FROM node:24-slim

# Cria usuário não-root para execução do worker.
RUN groupadd --gid 1001 worker && \
    useradd --uid 1001 --gid worker --shell /bin/false --create-home worker

WORKDIR /app

# Copia apenas os manifests primeiro para aproveitar o cache de camadas.
# Usa cópias explícitas em vez de glob para evitar adicionar arquivos
# inesperados; o .dockerignore na raiz também filtra segredos e build artifacts.
COPY package.json ./
COPY package-lock.json ./

# Instala dependências sem executar lifecycle scripts (segurança) e limpa cache.
RUN npm ci --ignore-scripts && npm cache clean --force

# Copia apenas o código necessário para o worker. Em dev o compose sobrescreve
# /app pelo bind mount, mas /app/node_modules fica como volume anônimo
# inicializado com o conteúdo desta imagem.
COPY workers ./workers

# Ajusta permissões para o usuário não-root.
RUN chown -R worker:worker /app
USER worker

# Portas padrão usadas pelos workers em dev. O compose pode mapear outras.
EXPOSE 8787 8788 8789

# Healthcheck leve: verifica se o processo wrangler responde na porta.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.WORKER_PORT || 8787) + '/').on('error', () => process.exit(1));"

# Default de desenvolvimento (T.I. Social). Cada serviço no compose.yaml
# sobrescreve este CMD com o wrangler.dev.toml e a porta da sua comunidade.
ENV WORKER_CONFIG=workers/tisocial/wrangler.dev.toml
ENV WORKER_PORT=8787
CMD ["sh", "-c", "npx wrangler dev --config ${WORKER_CONFIG} --local --port ${WORKER_PORT} --ip 0.0.0.0"]
