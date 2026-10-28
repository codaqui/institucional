// Copia as fontes canônicas de conteúdo (blog/ e trilhas/ na raiz, usadas pelo
// Docusaurus até a Fase 0.6) para dentro do app Astro, separando corpo (content
// collections) de assets (public/). Roda em predev/prebuild, idempotente.
// As páginas soltas (collection `pages`) deixaram de ser copiadas na Fase 0.6 —
// os .md canônicos moram versionados em frontend/src/content/pages/ (admonitions
// já convertidas em blockquote na origem).
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const FRONTEND = join(ROOT, "frontend");

const onlyMarkdown = (src) => {
  if (src.includes(`${sep}img${sep}`) || src.includes(`${sep}assets${sep}`)) return false;
  if (src.endsWith(`${sep}img`) || src.endsWith(`${sep}assets`)) return false; // dir raiz não tem separador depois
  if (src.endsWith("authors.yml")) return false;
  return true; // diretórios e demais arquivos passam; .md/.mdx são filtrados pelo glob loader
};

const copies = [
  { from: join(ROOT, "blog"), to: join(FRONTEND, "src", "content", "blog"), filter: onlyMarkdown },
  { from: join(ROOT, "trilhas"), to: join(FRONTEND, "src", "content", "trilhas"), filter: onlyMarkdown },
  { from: join(ROOT, "blog", "img"), to: join(FRONTEND, "public", "blog-assets", "img") },
  { from: join(ROOT, "trilhas", "github", "assets"), to: join(FRONTEND, "public", "trilhas-assets", "github", "assets") },
];

for (const { from, to, filter } of copies) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, ...(filter ? { filter } : {}) });
}
console.log(`copy-content: ${copies.length} origens copiadas`);

// Plano B (Task 7 do plano fase-0.2): os 2 posts .mdx usam componentes MUI,
// comentários HTML (`<!-- truncate -->`) e admonitions (`:::tip`) do Docusaurus,
// que o compilador MDX do Astro não aceita. O patch abaixo reescreve SOMENTE AS
// CÓPIAS em src/content/blog — os originais em blog/ seguem intactos para o
// build Docusaurus. Mapeamento literal por arquivo (não parser): cada entrada
// falha o build se o trecho original mudar, forçando revisão do patch.
const CARD_DIV =
  '<div class="rounded-lg border border-border border-s-4 border-s-action bg-surface p-4 shadow-sm">';
const CARD_CONTENT_DIV = '<div class="flex flex-col gap-1">';
const STACK_DIV = '<div class="mb-2 flex items-center gap-2">';
const OVERLINE_P = '<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">';
const BODY2_P = '<p class="text-sm text-text-secondary">';
const H4_P = '<p class="text-2xl font-extrabold text-action">';
const TRUNCATE_MDX = ["<!-- truncate -->", "{/* truncate */}"];

const muiImport = (spec) => [`import ${spec};`, ""];
const muiPkg = (name) => muiImport(`${name} from '@mui/material/${name}'`);
const muiIcon = (name) => muiImport(`${name}Icon from '@mui/icons-material/${name}'`);
const icon = (name, color, emoji) => [
  `<${name}Icon sx={{ color: '${color}.main' }} />`,
  `<span aria-hidden="true">${emoji}</span>`,
];
const card = (color) => [
  `<Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: '${color}.main' }}>`,
  CARD_DIV,
];
const typo = (variant, extra, to) => [
  `<Typography variant="${variant}"${extra ? ` ${extra}` : ""}>`,
  to,
];

const COMMON_MDX_PATCHES = [
  TRUNCATE_MDX,
  muiPkg("Grid"),
  muiPkg("Card"),
  muiPkg("CardContent"),
  muiPkg("Typography"),
  muiPkg("Stack"),
  ['<Stack direction="row" spacing={1.5} alignItems="center" mb={1}>', STACK_DIV],
  ["</Stack>", "</div>"],
  ['<Typography variant="overline" color="text.secondary">', OVERLINE_P],
  ['<Typography variant="body2" color="text.secondary">', BODY2_P],
  ["</Typography>", "</p>"],
  ["<CardContent>", CARD_CONTENT_DIV],
  ["</CardContent>", "</div>"],
  ["</Card>", "</div>"],
  ["</Grid>", "</div>"],
];

const MDX_PATCHES = {
  "2026-03-26-aumigo-prestacao-de-contas.mdx": [
    muiIcon("VolunteerActivism"),
    muiIcon("Restaurant"),
    muiIcon("Pets"),
    muiIcon("Medication"),
    ['<Grid container spacing={2} sx={{ my: 2 }}>', '<div class="my-4 grid gap-4 sm:grid-cols-2">'],
    ["<Grid size={{ xs: 12, sm: 6 }}>", "<div>"],
    card("success"),
    card("warning"),
    card("primary"),
    card("secondary"),
    icon("VolunteerActivism", "success", "🤝"),
    icon("Restaurant", "warning", "🍽️"),
    icon("Pets", "primary", "🐾"),
    icon("Medication", "secondary", "💊"),
    typo("h4", "fontWeight={800} color=\"success.main\"", H4_P),
    typo("h4", "fontWeight={800} color=\"warning.main\"", H4_P),
    typo("h4", "fontWeight={800} color=\"primary.main\"", H4_P),
    typo("h4", "fontWeight={800} color=\"secondary.main\"", H4_P),
    [
      ":::tip Transparência\nToda a arrecadação foi convertida em insumos para protetores e projetos parceiros — **nenhum centavo ficou pelo caminho**.\n:::",
      "> **Transparência**\n>\n> Toda a arrecadação foi convertida em insumos para protetores e projetos parceiros — **nenhum centavo ficou pelo caminho**.",
    ],
    [
      ":::info Páscoa Solidária 2026\n🍫 **464 caixas de bombons** entregues para a **APAE** e a **Associação Oriental de Maringá**, levando mais alegria para muitas crianças.\n:::",
      "> **Páscoa Solidária 2026**\n>\n> 🍫 **464 caixas de bombons** entregues para a **APAE** e a **Associação Oriental de Maringá**, levando mais alegria para muitas crianças.",
    ],
    ...COMMON_MDX_PATCHES,
  ],
  "2026-07-17-cloud-native-maringa-3-agile-brazil-c4p.mdx": [
    muiPkg("Button"),
    muiIcon("Campaign"),
    muiIcon("EventAvailable"),
    muiIcon("RecordVoiceOver"),
    ['<Grid container spacing={2} sx={{ my: 2 }}>', '<div class="my-4 grid gap-4 md:grid-cols-3">'],
    ["<Grid size={{ xs: 12, md: 4 }}>", "<div>"],
    card("primary"),
    card("secondary"),
    card("success"),
    icon("EventAvailable", "primary", "📅"),
    icon("Campaign", "secondary", "📣"),
    icon("RecordVoiceOver", "success", "🎤"),
    typo("h6", "fontWeight={800}", '<p class="text-lg font-extrabold text-text-primary">'),
    [
      `<Button
  variant="contained"
  color="primary"
  component="a"
  href="https://ocgroups.dev/explore?entity=events&group%5B0%5D=cloudnativemaringa&community%5B0%5D=cncf"
  target="_blank"
  rel="noopener noreferrer"
  sx={{ mt: 1.5 }}
>
  Ver calendário completo no Open Community Groups
</Button>`,
      `<a
  href="https://ocgroups.dev/explore?entity=events&group%5B0%5D=cloudnativemaringa&community%5B0%5D=cncf"
  target="_blank"
  rel="noopener noreferrer"
  class="mt-4 inline-block rounded-lg bg-action px-4 py-2 font-bold text-on-action hover:bg-action-hover"
>
  Ver calendário completo no Open Community Groups
</a>`,
    ],
    ...COMMON_MDX_PATCHES,
  ],
};

for (const [file, pairs] of Object.entries(MDX_PATCHES)) {
  const path = join(FRONTEND, "src", "content", "blog", file);
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      throw new Error(`copy-content: trecho do patch não encontrado em ${file}: ${JSON.stringify(from.slice(0, 80))}`);
    }
    text = text.replaceAll(from, to);
  }
  writeFileSync(path, text);
}
console.log(`copy-content: ${Object.keys(MDX_PATCHES).length} posts .mdx patchados (plano B)`);
