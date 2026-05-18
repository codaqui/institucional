import React, { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";

export interface ClubWalletTransactionItem {
  id: string;
  coinType: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description: string | null;
  createdAt: string;
}

const SOURCE_LABEL: Record<string, string> = {
  stripe_invoice: "Doacao",
  raffle_entry: "Sorteio (entrada)",
  raffle_refund: "Sorteio (reembolso)",
  manual_admin: "Ajuste manual",
  company_distribution: "Distribuicao empresa",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function ClubWalletTransactionsTable({
  transactions,
}: Readonly<{ transactions: ClubWalletTransactionItem[] }>) {
  const [selected, setSelected] = useState<ClubWalletTransactionItem | null>(null);

  const rows = useMemo(() => transactions, [transactions]);

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Origem</TableCell>
              <TableCell>Descricao</TableCell>
              <TableCell align="right">Coins</TableCell>
              <TableCell align="right">Detalhe</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.createdAt)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={SOURCE_LABEL[tx.source] ?? tx.source}
                  />
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Tooltip title={tx.description ?? "Sem descricao"}>
                    <Typography variant="body2" noWrap color="text.secondary">
                      {tx.description ?? "—"}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    color: tx.amount >= 0 ? "success.main" : "error.main",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label="Ver detalhes da transacao"
                    onClick={() => setSelected(tx)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" fontWeight={700}>
            Detalhes da transacao
          </Typography>
          <IconButton aria-label="Fechar detalhes" onClick={() => setSelected(null)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Box sx={{ display: "grid", gap: 1.25 }}>
              <Typography variant="body2"><strong>ID:</strong> {selected.id}</Typography>
              <Typography variant="body2"><strong>Data:</strong> {formatDate(selected.createdAt)}</Typography>
              <Typography variant="body2"><strong>Origem:</strong> {SOURCE_LABEL[selected.source] ?? selected.source}</Typography>
              <Typography variant="body2"><strong>Coins:</strong> {selected.amount}</Typography>
              <Typography variant="body2"><strong>Descricao:</strong> {selected.description ?? "—"}</Typography>
              <Typography variant="body2"><strong>Referencia:</strong> {selected.referenceId ?? "—"}</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
