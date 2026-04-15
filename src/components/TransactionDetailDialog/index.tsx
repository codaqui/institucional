import React, { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import {
  type Transaction,
  TX_TYPE_CONFIG,
  deriveTransactionMeta,
  formatBRL,
  formatDate,
} from "../../utils/transaction";
import { formatDocument } from "../../utils/document";

// ---------------------------------------------------------------------------
// Types for enrichment payloads
// ---------------------------------------------------------------------------

interface ReimbursementPublicInfo {
  id: string;
  status: string;
  amount: number;
  description: string;
  receiptUrl: string;
  internalReceiptUrl: string | null;
  accountName: string | null;
  requester: { handle: string; name: string; avatarUrl: string } | null;
  approver: { handle: string; name: string; avatarUrl: string } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface VendorPaymentPublicInfo {
  id: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  internalReceiptUrl: string | null;
  paidAt: string;
  vendor?: { name: string; document: string | null; website: string | null };
  paidBy?: { name: string; avatarUrl: string; githubHandle: string };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionDetailDialogProps {
  tx: Transaction | null;
  accountId: string;
  apiUrl: string;
  onClose: () => void;
}

export default function TransactionDetailDialog({
  tx,
  accountId,
  apiUrl,
  onClose,
}: Readonly<TransactionDetailDialogProps>) {
  const [reimbInfo, setReimbInfo] = useState<ReimbursementPublicInfo | null>(null);
  const [reimbLoading, setReimbLoading] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<VendorPaymentPublicInfo | null>(null);
  const [vendorLoading, setVendorLoading] = useState(false);

  const meta = tx ? deriveTransactionMeta(tx, accountId) : null;
  const type = meta?.type ?? "other";
  const config = meta?.config ?? TX_TYPE_CONFIG.other;

  useEffect(() => {
    if (!tx) { setReimbInfo(null); return; }
    if (type !== "reimbursement") { setReimbInfo(null); return; }

    const reimbId = tx.referenceId?.replace("reimbursement:", "");
    if (!reimbId) return;

    setReimbLoading(true);
    fetch(`${apiUrl}/reimbursements/public/${reimbId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setReimbInfo(data))
      .catch(() => setReimbInfo(null))
      .finally(() => setReimbLoading(false));
  }, [tx, type, apiUrl]);

  useEffect(() => {
    if (!tx) { setVendorInfo(null); return; }
    if (type !== "vendor-payment") { setVendorInfo(null); return; }

    const refId = tx.referenceId;
    if (!refId) return;

    setVendorLoading(true);
    fetch(`${apiUrl}/vendors/payments/by-reference/${encodeURIComponent(refId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setVendorInfo(data))
      .catch(() => setVendorInfo(null))
      .finally(() => setVendorLoading(false));
  }, [tx, type, apiUrl]);

  if (!tx || !meta) return null;

  const {
    isCredit, donorHandle, isSubscription, subscriptionInterval,
    paymentIntentId, stripeDashboardUrl, reimbDesc, isTransfer, transferReason,
  } = meta;

  return (
    <Dialog
      open={!!tx}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { borderTop: 3, borderColor: `${config.color}.main` },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip icon={config.icon} label={config.label} color={config.color} size="small" variant="outlined" />
          {isSubscription && type === "donation" && (
            <Chip label={`Recorrente ${subscriptionInterval}`} size="small" color="info" variant="outlined" />
          )}
          <Typography variant="h6" fontWeight={700}>
            {isCredit ? "+" : "−"} {formatBRL(Number(tx.amount))}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Fechar">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.disabled">Data</Typography>
            <Typography variant="body2" fontWeight={600}>{formatDate(tx.createdAt)}</Typography>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.disabled">ID da transação</Typography>
            <Tooltip title={tx.id}>
              <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "monospace", fontSize: "0.7rem", color: "text.secondary" }}>
                {tx.id.slice(0, 16)}…
              </Typography>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1.5, mb: 2, p: 1.5,
          borderRadius: 2, bgcolor: "action.hover", flexWrap: "wrap",
        }}>
          <Box sx={{ flex: 1, minWidth: 100 }}>
            <Typography variant="caption" color="text.disabled">De</Typography>
            <Typography variant="body2" fontWeight={700}>{tx.sourceAccount?.name}</Typography>
          </Box>
          <CompareArrowsIcon sx={{ color: "text.disabled", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 100 }}>
            <Typography variant="caption" color="text.disabled">Para</Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main">{tx.destinationAccount?.name}</Typography>
          </Box>
        </Box>

        {/* Donation details */}
        {type === "donation" && (
          <>
            {donorHandle ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Doador</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Avatar
                    src={`https://github.com/${donorHandle.replace("@", "")}.png?size=32`}
                    alt={donorHandle}
                    sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
                  />
                  <Button
                    size="small" variant="text"
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    href={`https://github.com/${donorHandle.replace("@", "")}`}
                    target="_blank" rel="noopener noreferrer"
                    sx={{ fontWeight: 700, textTransform: "none" }}
                  >
                    {donorHandle}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Doador</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic", color: "text.secondary" }}>
                  Doação anônima
                </Typography>
              </Box>
            )}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.disabled">Tipo</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {isSubscription
                  ? `Assinatura recorrente (${subscriptionInterval})`
                  : "Pagamento único"}
              </Typography>
            </Box>
          </>
        )}

        {/* Reimbursement details */}
        {type === "reimbursement" && (
          <>
            {reimbDesc && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Finalidade do reembolso</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>"{reimbDesc}"</Typography>
              </Box>
            )}
            {reimbLoading && (
              <Box sx={{ mb: 2 }}>
                <Skeleton height={24} width="60%" />
                <Skeleton height={20} width="40%" />
              </Box>
            )}
            {reimbInfo && (
              <>
                {reimbInfo.requester && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Solicitado por</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Avatar
                        src={reimbInfo.requester.avatarUrl}
                        alt={reimbInfo.requester.handle}
                        sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
                      />
                      <Button
                        size="small" variant="text"
                        endIcon={<OpenInNewIcon fontSize="small" />}
                        href={`https://github.com/${reimbInfo.requester.handle}`}
                        target="_blank" rel="noopener noreferrer"
                        sx={{ fontWeight: 700, textTransform: "none" }}
                      >
                        @{reimbInfo.requester.handle}
                      </Button>
                    </Box>
                  </Box>
                )}
                {reimbInfo.approver && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Aprovado por</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Avatar
                        src={reimbInfo.approver.avatarUrl}
                        alt={reimbInfo.approver.handle}
                        sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        @{reimbInfo.approver.handle}
                      </Typography>
                      {reimbInfo.reviewedAt && (
                        <Typography variant="caption" color="text.secondary">
                          em {formatDate(reimbInfo.reviewedAt)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                {reimbInfo.reviewNote && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Nota do aprovador</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic", color: "text.secondary" }}>
                      "{reimbInfo.reviewNote}"
                    </Typography>
                  </Box>
                )}
                {(reimbInfo.receiptUrl || reimbInfo.internalReceiptUrl) && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Comprovantes</Typography>
                    <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {reimbInfo.receiptUrl && (
                        <Button
                          size="small" variant="outlined" color="warning"
                          startIcon={<ReceiptLongIcon />}
                          endIcon={<OpenInNewIcon fontSize="small" />}
                          href={reimbInfo.receiptUrl}
                          target="_blank" rel="noopener noreferrer"
                          sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
                        >
                          Comprovante original
                        </Button>
                      )}
                      {reimbInfo.internalReceiptUrl && (
                        <Button
                          size="small" variant="outlined" color="primary"
                          startIcon={<ReceiptLongIcon />}
                          endIcon={<OpenInNewIcon fontSize="small" />}
                          href={reimbInfo.internalReceiptUrl}
                          target="_blank" rel="noopener noreferrer"
                          sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
                        >
                          Cópia interna
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}
              </>
            )}
          </>
        )}

        {/* Transfer details */}
        {isTransfer && transferReason && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.disabled">Justificativa da transferência</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>"{transferReason}"</Typography>
          </Box>
        )}

        {/* Vendor payment details */}
        {type === "vendor-payment" && (
          <>
            {tx.description && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Finalidade do pagamento</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {tx.description.includes(" — ")
                    ? tx.description.split(" — ").slice(1).join(" — ")
                    : tx.description}
                </Typography>
              </Box>
            )}
            {vendorLoading && (
              <Box sx={{ mb: 2 }}>
                <Skeleton height={24} width="60%" />
                <Skeleton height={20} width="40%" />
              </Box>
            )}
            {vendorInfo?.vendor && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Fornecedor</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                  <StorefrontIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: "middle" }} />
                  {vendorInfo.vendor.name}
                  {vendorInfo.vendor.document && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({formatDocument(vendorInfo.vendor.document)})
                    </Typography>
                  )}
                </Typography>
                {vendorInfo.vendor.website && (
                  <Button
                    size="small"
                    variant="text"
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    href={vendorInfo.vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ textTransform: "none", fontSize: "0.75rem", mt: 0.5 }}
                  >
                    {vendorInfo.vendor.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </Button>
                )}
              </Box>
            )}
            {vendorInfo?.paidBy && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Autorizado/registrado por</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Avatar
                    src={vendorInfo.paidBy.avatarUrl}
                    alt={vendorInfo.paidBy.name}
                    sx={{ width: 28, height: 28 }}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{vendorInfo.paidBy.name}</Typography>
                    <Typography variant="caption" color="text.secondary">@{vendorInfo.paidBy.githubHandle}</Typography>
                  </Box>
                </Box>
              </Box>
            )}
            {vendorInfo && (vendorInfo.receiptUrl || vendorInfo.internalReceiptUrl) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Comprovantes</Typography>
                <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {vendorInfo.receiptUrl && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<ReceiptLongIcon />}
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      href={vendorInfo.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
                    >
                      Comprovante original
                    </Button>
                  )}
                  {vendorInfo.internalReceiptUrl && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<ReceiptLongIcon />}
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      href={vendorInfo.internalReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
                    >
                      Cópia interna
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </>
        )}

        {/* Generic/other */}
        {type === "other" && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.disabled">Descrição</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {tx.description}
            </Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          {stripeDashboardUrl && paymentIntentId && (
            <Chip
              label={`Stripe: ${paymentIntentId.slice(0, 24)}…`}
              size="small" variant="outlined" color="success"
              icon={<OpenInNewIcon />}
              component="a"
              href={stripeDashboardUrl}
              target="_blank" rel="noopener noreferrer"
              clickable
              sx={{ fontFamily: "monospace", fontSize: "0.68rem" }}
            />
          )}
          {tx.referenceId && !paymentIntentId && (
            <Tooltip title={tx.referenceId}>
              <Chip
                label={tx.referenceId.slice(0, 30) + (tx.referenceId.length > 30 ? "…" : "")}
                size="small" variant="outlined"
                sx={{ fontFamily: "monospace", fontSize: "0.68rem" }}
              />
            </Tooltip>
          )}
          {!tx.referenceId && (
            <Typography variant="caption" color="text.disabled">Sem referência externa vinculada.</Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
