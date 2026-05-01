import React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ReplayIcon from "@mui/icons-material/Replay";
import { formatCurrencyCents, formatDateTimeBR } from "../../utils/vendorFormat";

export interface VendorTransactionCardData {
  id: string;
  amount: number;
  description: string;
  occurredAt: string;
  receiptUrl: string | null;
  internalReceiptUrl: string | null;
  vendor?: { name: string };
  registeredBy?: { name: string; avatarUrl: string; githubHandle: string };
}

export interface VendorTransactionCardProps {
  tx: VendorTransactionCardData;
  direction: "payment" | "receipt";
  /** Label da conta de origem (payment) ou destino (receipt). */
  accountLabel: string;
  onReuse: () => void;
  onDelete: () => void;
}

/**
 * Card de histórico para uma transação de fornecedor (payment ou receipt).
 * Compartilhado entre /admin/pagamentos e /admin/recebimentos para evitar duplicação.
 */
export default function VendorTransactionCard({
  tx,
  direction,
  accountLabel,
  onReuse,
  onDelete,
}: Readonly<VendorTransactionCardProps>) {
  const isReceipt = direction === "receipt";
  const amountColor = isReceipt ? "success.main" : "error.main";
  const amountPrefix = isReceipt ? "+ " : "";
  const noun = isReceipt ? "recebimento" : "pagamento";

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {tx.vendor?.name ?? "Fornecedor desconhecido"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tx.description}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" fontWeight={700} color={amountColor}>
              {amountPrefix}
              {formatCurrencyCents(tx.amount)}
            </Typography>
            <Tooltip title="Reutilizar dados">
              <IconButton size="small" aria-label={`Reutilizar ${noun}`} color="primary" onClick={onReuse}>
                <ReplayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir (com estorno)">
              <IconButton size="small" aria-label={`Excluir ${noun}`} color="error" onClick={onDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Box display="flex" gap={1} mt={1} flexWrap="wrap" alignItems="center">
          {tx.registeredBy && (
            <Tooltip title={`Registrado por @${tx.registeredBy.githubHandle}`}>
              <Chip
                size="small"
                avatar={<Avatar src={tx.registeredBy.avatarUrl} alt={tx.registeredBy.name} />}
                label={`@${tx.registeredBy.githubHandle}`}
                variant="outlined"
              />
            </Tooltip>
          )}
          <Chip size="small" label={accountLabel} variant="outlined" />
          <Chip size="small" label={formatDateTimeBR(tx.occurredAt)} variant="outlined" />
          {tx.receiptUrl && (
            <Chip
              size="small"
              icon={<ReceiptLongIcon />}
              label="Comprovante"
              component="a"
              href={tx.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              clickable
            />
          )}
          {tx.internalReceiptUrl && (
            <Chip
              size="small"
              icon={<ReceiptLongIcon />}
              label="Cópia interna"
              component="a"
              href={tx.internalReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              color="primary"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
