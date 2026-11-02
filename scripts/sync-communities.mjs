import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT_FILE = path.join(ROOT, "static", "communities", "index.json");

export async function syncCommunities({
  apiUrl = process.env.COMMUNITIES_API_URL ?? "http://localhost:3001",
  outputFile = DEFAULT_OUTPUT_FILE,
  now = () => new Date(),
  fetchImpl = fetch,
} = {}) {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/communities/public`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar comunidades: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Resposta inválida de /communities/public: esperado um array.");
  }

  const communities = payload.filter((community) => community?.status === "active");
  try {
    const previous = JSON.parse(await readFile(outputFile, "utf8"));
    if (
      typeof previous.generatedAt === "string" &&
      isDeepStrictEqual(previous.communities, communities)
    ) {
      return previous;
    }
  } catch {
    // A primeira execução ou um snapshot ilegível segue para uma gravação completa.
  }

  const snapshot = {
    generatedAt: now().toISOString(),
    communities,
  };
  const outputDirectory = path.dirname(outputFile);
  const temporaryFile = path.join(outputDirectory, `.${path.basename(outputFile)}.${randomUUID()}.tmp`);

  await mkdir(outputDirectory, { recursive: true });
  try {
    await writeFile(temporaryFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(temporaryFile, outputFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }

  return snapshot;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const snapshot = await syncCommunities();
    console.log(`✓ ${snapshot.communities.length} comunidades sincronizadas em ${DEFAULT_OUTPUT_FILE}`);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
