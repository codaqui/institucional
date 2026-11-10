import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Company } from "./types";

export default function CompanyBadgeCard({ company }: Readonly<{ company: Company }>) {
  const label = company.tier === "aliada" ? "Empresa Aliada Codaqui" : "Empresa Amiga Codaqui";
  if (!company.sealActive) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Selo com renovação pendente. A administração precisa validar novamente a evidência para gerar um novo badge.
      </Alert>
    );
  }

  const badgePath = `/badges/empresas/${company.id}.svg`;
  const absoluteUrl = `${window.location.origin}${badgePath}`;
  const markdown = `![Selo ${label}](${absoluteUrl})`;
  const html = `<img src="${absoluteUrl}" alt="Selo ${label}" />`;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" component="h3">Selo para README e website</Typography>
          <Chip size="small" label={label} />
          <Chip size="small" variant="outlined" label={company.tier === "aliada" ? `Válido até ${new Date(company.sealValidUntil!).toLocaleDateString("pt-BR")}` : "Apoio ativo"} />
        </Box>
        <Box component="img" src={badgePath} alt={`Selo ${label}`} sx={{ display: "block", width: "100%", maxWidth: 480, height: "auto", mb: 2 }} />
        <TextField fullWidth size="small" label="Markdown" value={markdown} slotProps={{ htmlInput: { readOnly: true } }} sx={{ mb: 1 }} />
        <TextField fullWidth size="small" label="HTML" value={html} slotProps={{ htmlInput: { readOnly: true } }} />
      </CardContent>
    </Card>
  );
}
