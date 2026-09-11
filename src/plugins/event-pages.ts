import fs from "fs";
import path from "path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import type { EventSummary } from "../data/events";
import { buildEventPath } from "../utils/event-path";

interface EventIndexFile {
  events?: EventSummary[];
}

/**
 * Gera uma página estática por evento (`/eventos/detalhe/<source>/<sourceId>/<id>`)
 * a partir do snapshot `static/events/index.json`, para que crawlers de preview
 * (WhatsApp, LinkedIn, Twitter) recebam OG/JSON-LD corretos sem executar JS.
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
        const routePath = buildEventPath(event.source, event.sourceId, event.id);
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
