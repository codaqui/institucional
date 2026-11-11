import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { buildBadgeSnippets } from "../../../../lib/badge-snippet";

interface ProfileBadgesProps {
  name: string;
  githubHandle: string;
}

function legacyCopy(text: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.insetBlockStart = "0";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

export default function ProfileBadges({ name, githubHandle }: Readonly<ProfileBadgesProps>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const src = `/badges/${encodeURIComponent(githubHandle)}.svg`;
  const snippets = buildBadgeSnippets(window.location.origin, githubHandle);

  const announce = (message: string) => {
    setStatus((current) => {
      const repeated = current.replace(/\u00a0$/, "") === message;
      return repeated && !current.endsWith("\u00a0") ? `${message}\u00a0` : message;
    });
  };

  const copySnippet = async (label: "Markdown" | "HTML", text: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(text);
      announce(`${label} copiado.`);
    } catch {
      if (legacyCopy(text)) announce(`${label} copiado.`);
      else announce("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  };

  if (failedSrc === src) return null;

  return (
    <Box component="section" aria-labelledby="public-badge-title" sx={{ mt: 4 }}>
      <Typography id="public-badge-title" variant="h5" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
        Selo público
      </Typography>
      <Box
        component="img"
        src={src}
        alt={`Selo Codaqui de ${name}`}
        width="640"
        height="120"
        loading="lazy"
        onError={() => setFailedSrc(src)}
        sx={{ display: "block", maxWidth: "100%", height: "auto", mb: 3 }}
      />
      <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Compartilhe seu selo
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Copie o Markdown e insira no README do seu perfil ou projeto. Também há uma versão HTML.
      </Typography>
      {(["Markdown", "HTML"] as const).map((label) => {
        const snippet = label === "Markdown" ? snippets.markdown : snippets.html;
        return (
          <Box key={label} sx={{ mb: 2 }}>
            <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {label}
            </Typography>
            <Box
              component="pre"
              tabIndex={0}
              aria-label={`Código ${label} do selo`}
              sx={{
                m: 0,
                p: 2,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                bgcolor: "action.hover",
                borderRadius: 1,
                fontSize: "0.8rem",
              }}
            >
              <code>{snippet}</code>
            </Box>
            <Button
              type="button"
              variant="outlined"
              size="small"
              sx={{ mt: 1 }}
              onClick={() => void copySnippet(label, snippet)}
            >
              Copiar {label}
            </Button>
          </Box>
        );
      })}
      <Typography role="status" variant="body2" sx={{ minHeight: "1.5em" }}>
        {status}
      </Typography>
    </Box>
  );
}
