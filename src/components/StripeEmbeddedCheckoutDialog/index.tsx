import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

interface StripeEmbeddedCheckoutDialogProps {
  open: boolean;
  title: string;
  stripeKey: string;
  clientSecret: string | null;
  onClose: () => void;
  onComplete?: () => void;
  missingKeyMessage?: string;
}

export default function StripeEmbeddedCheckoutDialog({
  open,
  title,
  stripeKey,
  clientSecret,
  onClose,
  onComplete,
  missingKeyMessage = "A chave pública do Stripe não está configurada.",
}: Readonly<StripeEmbeddedCheckoutDialogProps>): React.JSX.Element {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (open && stripeKey && !stripePromise) {
      setStripePromise(loadStripe(stripeKey));
    }
  }, [open, stripeKey, stripePromise]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderTop: 3, borderColor: "primary.main", minHeight: 400 } } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CreditCardIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Fechar checkout">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, pb: "0 !important", minHeight: 400 }}>
        {!stripeKey && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="warning">{missingKeyMessage}</Alert>
          </Box>
        )}
        {stripeKey && stripePromise && clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret, onComplete }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
