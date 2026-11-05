import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { shouldRunPagefind } from "../src/lib/pagefind-contract.ts";

if (shouldRunPagefind(process.env.TENANT)) {
  const pagefind = fileURLToPath(new URL("../node_modules/.bin/pagefind", import.meta.url));
  const result = spawnSync(pagefind, ["--site", "dist"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log(`pagefind: índice ignorado no build tenant ${process.env.TENANT}`);
}
