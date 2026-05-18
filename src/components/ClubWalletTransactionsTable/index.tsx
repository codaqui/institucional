import React, { useMemo, useState } from "react";
import Chip from "@mui/material/Chip";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import WalletTransactionDetailDialog from "../WalletTransactionDetailDialog";
import { formatWalletDate, resolveWalletSourceLabel } from "../../utils/wallet-transactions";

export interface ClubWalletTransactionItem {
  id: string;
  coinType: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description: string | null;
  createdAt: string;
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
                <TableCell>{formatWalletDate(tx.createdAt)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={resolveWalletSourceLabel(tx.source)}
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

      <WalletTransactionDetailDialog
        tx={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
