# Dockerfile para os Cloudflare Workers das comunidades.
#
# Resolve o problema de arquitetura nativa do workerd: instalamos as
# dependências dentro do container Linux, em vez de montar node_modules
# do host (que pode ter binários do macOS).
#
# Cada comunidade reusa esta mesma imagem; o wrangler.toml específico e
# a porta são passados via compose.

FROM node:24-slim

WORKDIR /app

# Copia apenas os manifests primeiro para aproveitar o cache de camadas.
COPY package.json package-lock.json* ./
RUN npm ci

# Copia o restante do repo. Em dev o compose sobrescreve /app pelo bind
# mount, mas /app/node_modules fica como volume anônimo inicializado com
# o conteúdo desta imagem.
COPY . .

# Portas padrão usadas pelos workers em dev. O compose pode mapear outras.
EXPOSE 8787 8788 8789

# Default de desenvolvimento (T.I. Social). Cada serviço no compose.yaml
# sobrescreve este CMD com o wrangler.dev.toml e a porta da sua comunidade.
ENV WORKER_CONFIG=workers/tisocial/wrangler.dev.toml
ENV WORKER_PORT=8787
CMD ["sh", "-c", "npx wrangler dev --config ${WORKER_CONFIG} --local --port ${WORKER_PORT} --ip 0.0.0.0"]
