import React from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { type WalletTxDetailData, formatWalletDate, resolveWalletSourceLabel } from "../../utils/wallet-transactions";

interface WalletTransactionDetailDialogProps {
  tx: WalletTxDetailData | null;
  onClose: () => void;
}

export default function WalletTransactionDetailDialog({
  tx,
  onClose,
}: Readonly<WalletTransactionDetailDialogProps>): React.JSX.Element {
  return (
    <Dialog open={!!tx} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Detalhes da transação</DialogTitle>
      <DialogContent>
        {tx && (
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography variant="body2"><strong>ID:</strong> {tx.id}</Typography>
            {tx.ownerName && (
              <Typography variant="body2"><strong>Titular:</strong> {tx.ownerName}</Typography>
            )}
            {tx.ownerType && (
              <Typography variant="body2">
                <strong>Tipo:</strong> {tx.ownerType === "company" ? "Empresa" : "Membro"}
              </Typography>
            )}
            <Typography variant="body2"><strong>Data:</strong> {formatWalletDate(tx.createdAt)}</Typography>
            <Typography variant="body2"><strong>Origem:</strong> {resolveWalletSourceLabel(tx.source)}</Typography>
            <Typography variant="body2"><strong>Coins:</strong> {tx.amount}</Typography>
            <Typography variant="body2"><strong>Descrição:</strong> {tx.description ?? "—"}</Typography>
            <Typography variant="body2"><strong>Referência:</strong> {tx.referenceId ?? "—"}</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
