import { spawnSync } from "node:child_process";
import { shouldRunPagefind } from "../src/lib/pagefind-contract.ts";

if (shouldRunPagefind(process.env.TENANT)) {
  const result = spawnSync("npx", ["pagefind", "--site", "dist"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log(`pagefind: índice ignorado no build tenant ${process.env.TENANT}`);
}
