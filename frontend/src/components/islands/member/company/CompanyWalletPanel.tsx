/**
 * Carteira da empresa — histórico de transações paginado e distribuição de
 * SortCoins para carteiras pessoais. Port 1:1 do `TransactionsSection` e do
 * `DistributeSection` (MyCompanySection, Docusaurus).
 */
import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TokenIcon from "@mui/icons-material/Token";
import SendIcon from "@mui/icons-material/Send";
import type { CompanyWalletTransaction, DistributeRecipient } from "./types";

interface WalletTransactionsProps {
  readonly transactions: CompanyWalletTransaction[];
  readonly transactionsTotal: number;
  readonly transactionsPage: number;
  readonly transactionsLimit: number;
  readonly txLoading: boolean;
  readonly onPageChange: (page: number) => void;
}

export function WalletTransactions({
  transactions, transactionsTotal, transactionsPage, transactionsLimit, txLoading, onPageChange,
}: WalletTransactionsProps): React.JSX.Element {
  return (
    <>
      <Typography variant="subtitle2" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
        Histórico da carteira da empresa
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
        Últimas 20 movimentações de SortCoins da conta empresarial.
      </Typography>
      {txLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <>
          {transactions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Nenhuma transação registrada até o momento.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {transactions.map((tx) => (
                <Card key={tx.id} variant="outlined">
                  <CardContent sx={{ py: "10px !important" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {tx.description ?? "Movimentação de carteira"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tx.source} · {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={tx.amount >= 0 ? "success" : "warning"}
                        variant="outlined"
                        label={`${tx.amount >= 0 ? "+" : ""}${tx.amount} ${tx.coinType}`}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
      {transactionsTotal > transactionsLimit && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Pagination
            page={transactionsPage}
            count={Math.max(1, Math.ceil(transactionsTotal / transactionsLimit))}
            onChange={(_, value) => onPageChange(value)}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </>
  );
}

interface DistributePanelProps {
  readonly recipients: DistributeRecipient[];
  readonly sortCoins: number;
  readonly distribMode: "equal" | "custom";
  readonly setDistribMode: (mode: "equal" | "custom") => void;
  readonly distribTotal: string;
  readonly setDistribTotal: (value: string) => void;
  readonly distribCustom: Record<string, string>;
  readonly setDistribCustom: (value: Record<string, string>) => void;
  readonly distribError: string | null;
  readonly distribSuccess: string | null;
  readonly distributing: boolean;
  readonly onDistribute: () => void;
}

export function DistributePanel({
  recipients, sortCoins,
  distribMode, setDistribMode,
  distribTotal, setDistribTotal,
  distribCustom, setDistribCustom,
  distribError, distribSuccess,
  distributing, onDistribute,
}: DistributePanelProps): React.JSX.Element {
  const equalHint = useMemo(() => {
    if (!distribTotal || Number.isNaN(Number.parseInt(distribTotal, 10)) || recipients.length === 0) return undefined;
    return `≈ ${Math.floor(Number.parseInt(distribTotal, 10) / recipients.length)} por pessoa`;
  }, [distribTotal, recipients.length]);

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography
        variant="subtitle2"
        component="h3"
        gutterBottom
        sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}
      >
        <TokenIcon fontSize="small" color="primary" /> Distribuir SortCoins
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
        Transfere SortCoins da carteira da empresa para as carteiras pessoais. O dono (você) aparece com ★.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Chip
          label="Dividir igualmente"
          size="small"
          color={distribMode === "equal" ? "primary" : "default"}
          variant={distribMode === "equal" ? "filled" : "outlined"}
          onClick={() => setDistribMode("equal")}
          clickable
        />
        <Chip
          label="Valor personalizado"
          size="small"
          color={distribMode === "custom" ? "primary" : "default"}
          variant={distribMode === "custom" ? "filled" : "outlined"}
          onClick={() => setDistribMode("custom")}
          clickable
        />
      </Stack>
      {distribMode === "equal" ? (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            label={`Total a dividir (${recipients.length} pessoa(s))`}
            value={distribTotal}
            onChange={(e) => setDistribTotal(e.target.value)}
            size="small"
            type="number"
            placeholder="ex: 100"
            helperText={equalHint}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={distributing ? <CircularProgress size={14} /> : <SendIcon />}
            onClick={onDistribute}
            disabled={distributing || !distribTotal.trim() || sortCoins === 0}
            sx={{ whiteSpace: "nowrap", mt: 0.5 }}
          >
            Distribuir
          </Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          {recipients.map((r) => (
            <Box key={r.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>
                {r.isOwner ? "★ " : ""}@{r.memberId}
              </Typography>
              <TextField
                size="small"
                type="number"
                placeholder="coins"
                value={distribCustom[r.id] ?? ""}
                onChange={(e) => setDistribCustom({ ...distribCustom, [r.id]: e.target.value })}
                sx={{ width: 100 }}
              />
            </Box>
          ))}
          <Button
            variant="contained"
            size="small"
            startIcon={distributing ? <CircularProgress size={14} /> : <SendIcon />}
            onClick={onDistribute}
            disabled={distributing || sortCoins === 0}
            sx={{ alignSelf: "flex-start" }}
          >
            Distribuir
          </Button>
        </Stack>
      )}
      {distribError && <Alert severity="error" sx={{ mt: 1 }}>{distribError}</Alert>}
      {distribSuccess && <Alert severity="success" sx={{ mt: 1 }}>{distribSuccess}</Alert>}
    </>
  );
}
