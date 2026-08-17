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

CMD ["npx", "wrangler", "dev", "--config", "workers/tisocial/wrangler.dev.toml", "--local", "--port", "8787", "--ip", "0.0.0.0"]
