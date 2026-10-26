/**
 * Resumo de apoio da empresa — chips com total apoiado (R$), quantidade de
 * apoios e meses apoiando. Port 1:1 do bloco de chips do `CompanyInfo`
 * (MyCompanySection, Docusaurus).
 */
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import type { CompanySupportSummary } from "./types";

interface SupportSummaryProps {
  readonly supportSummary: CompanySupportSummary;
}

export default function SupportSummary({ supportSummary }: SupportSummaryProps): React.JSX.Element {
  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ mt: 1, flexWrap: "wrap" }}
    >
      <Chip
        size="small"
        variant="outlined"
        label={`R$ ${supportSummary.totalSupportedReais.toLocaleString("pt-BR")} apoiados`}
      />
      <Chip
        size="small"
        variant="outlined"
        label={`${supportSummary.supportCount} apoio${supportSummary.supportCount === 1 ? "" : "s"}`}
      />
      <Chip
        size="small"
        variant="outlined"
        label={`${supportSummary.monthsSupporting} mês${supportSummary.monthsSupporting === 1 ? "" : "es"} apoiando`}
      />
    </Stack>
  );
}
