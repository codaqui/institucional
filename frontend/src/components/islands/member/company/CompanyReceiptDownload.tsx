import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import DownloadIcon from "@mui/icons-material/Download";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import { generateCompanyReceiptPdf, type CompanyReceipt } from "../../DonationReceiptPdf/index.tsx";

export default function CompanyReceiptDownload({ receiptUrl }: Readonly<{ receiptUrl: string }>) {
  const { authFetch } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const download = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGenerating(true);
    setError("");
    try {
      const response = await authFetch(`${receiptUrl}?month=${encodeURIComponent(month)}`);
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível carregar a fatura do mês."));
        return;
      }
      const receipt = await response.json() as CompanyReceipt;
      await generateCompanyReceiptPdf(receipt, import.meta.env.SITE || "https://codaqui.dev");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o comprovante PDF.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box component="form" onSubmit={download} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, mt: 1 }}>
      {error && <Alert severity="error" sx={{ width: "100%" }}>{error}</Alert>}
      <TextField
        label="Mês do comprovante"
        name="month"
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        required
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Button
        type="submit"
        size="small"
        variant="text"
        disabled={generating}
        startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
        sx={{ textTransform: "none" }}
      >
        {generating ? "Gerando…" : "Baixar comprovante PDF"}
      </Button>
    </Box>
  );
}
