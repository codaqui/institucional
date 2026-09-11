import fs from "fs";
import path from "path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import type { EventSummary } from "../data/events";
import { buildEventPublicPath } from "../utils/event-path";

interface EventIndexFile {
  events?: EventSummary[];
}

/**
 * Slugs que colidem com páginas estáticas existentes em `src/pages/eventos/`
 * (`detalhe.tsx`, `comprovante.tsx`) — evento interno com um desses slugs não
 * ganha rota por slug (fica só no fallback por id/query).
 */
const RESERVED_EVENT_SLUGS = new Set(["detalhe", "comprovante"]);

/**
 * Resolve o path da rota estática do evento: internos com slug usam
 * `/eventos/<slug>`; internos legados sem slug e externos usam
 * `/eventos/<source>/<sourceId>/<id>`. Retorna null quando o slug colide com
 * uma página estática reservada.
 */
function resolveEventRoutePath(event: EventSummary): string | null {
  if (
    event.source === "internal" &&
    event.slug &&
    RESERVED_EVENT_SLUGS.has(event.slug)
  ) {
    console.warn(
      `[codaqui-event-pages] Slug reservado ignorado: ${event.slug} (evento ${event.id}) — colide com página estática em /eventos`
    );
    return null;
  }
  return buildEventPublicPath(event);
}

/**
 * Gera uma página estática por evento (`/eventos/<slug>` para internos,
 * `/eventos/<source>/<sourceId>/<id>` para externos) a partir do snapshot
 * `static/events/index.json`, para que crawlers de preview (WhatsApp,
 * LinkedIn, Twitter) recebam OG/JSON-LD corretos sem executar JS.
 */
export default function eventPagesPlugin(context: LoadContext): Plugin {
  return {
    name: "codaqui-event-pages",

    loadContent(): EventSummary[] {
      const indexPath = path.join(
        context.siteDir,
        "static",
        "events",
        "index.json"
      );
      const parsed = JSON.parse(
        fs.readFileSync(indexPath, "utf-8")
      ) as EventIndexFile;
      return parsed.events ?? [];
    },

    async contentLoaded({ content, actions }): Promise<void> {
      const { createData, addRoute } = actions;
      const events = content as EventSummary[];
      const seenPaths = new Set<string>();
      let counter = 0;

      for (const event of events) {
        const routePath = resolveEventRoutePath(event);
        if (!routePath) continue;
        if (seenPaths.has(routePath)) {
          console.warn(
            `[codaqui-event-pages] Rota duplicada ignorada: ${routePath} (evento ${event.id})`
          );
          continue;
        }
        seenPaths.add(routePath);

        const dataPath = await createData(
          `event-${counter}.json`,
          JSON.stringify(event)
        );
        counter += 1;

        addRoute({
          path: routePath,
          exact: true,
          component: "@site/src/components/EventDetailRoute/index.tsx",
          modules: { content: dataPath },
        });
      }
    },
  };
}
