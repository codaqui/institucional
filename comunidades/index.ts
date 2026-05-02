/**
 * Single source of truth for ALL community configs.
 *
 * Auto-discovery isn't possible at runtime in the browser, but having ONE
 * place that imports every community.config.ts means:
 *   - docusaurus.config.ts can build plugins for all communities by mapping
 *   - src/lib/community-context.ts can resolve communities by path
 *   - new community = add 1 import line + 1 array entry
 */

import tisocialConfig from "./tisocial/community.config";
import type { CommunitySiteConfig } from "./tisocial/community.config";

export const COMMUNITIES_CONFIG: CommunitySiteConfig[] = [
  tisocialConfig,
  // Quando adicionar nova comunidade, basta:
  //   1. import myCommunityConfig from "./<slug>/community.config";
  //   2. Acrescentar `myCommunityConfig` neste array.
  //   3. docusaurus.config.ts gera os plugins de blog/docs automaticamente.
  //   4. Criar páginas TSX em src/pages/comunidades/<slug>/.
];

export type { CommunitySiteConfig } from "./tisocial/community.config";
