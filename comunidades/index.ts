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
import elasnocodigoConfig from "./elasnocodigo/community.config";
import type { CommunitySiteConfig } from "./shared/types";

export const COMMUNITIES_CONFIG: CommunitySiteConfig[] = [
  tisocialConfig,
  elasnocodigoConfig,
  // Quando adicionar nova comunidade, basta:
  //   1. import myCommunityConfig from "./<slug>/community.config";
  //   2. Acrescentar `myCommunityConfig` neste array.
  //   3. docusaurus.config.ts gera os plugins de blog/docs/pages automaticamente.
  //   4. Criar páginas TSX em comunidades/<slug>/src/pages/.
];

export type { CommunitySiteConfig } from "./shared/types";
