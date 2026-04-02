import React from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

export type ModalConfirmVariant = "warning" | "error" | "success" | "info";

interface ModalConfirmProps {
  /** Controla visibilidade */
  readonly open: boolean;
  readonly onClose: () => void;

  /** Textos */
  readonly title: string;
  readonly description?: React.ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;

  /** Estilo do botão de confirmação */
  readonly variant?: ModalConfirmVariant;

  /** Estado de carregamento durante ação async */
  readonly loading?: boolean;

  /** Mensagem de erro exibida dentro do modal */
  readonly error?: string;

  /** Callback executado ao confirmar */
  readonly onConfirm: () => void | Promise<void>;
}

const variantColor: Record<ModalConfirmVariant, "warning" | "error" | "success" | "primary"> = {
  warning: "warning",
  error: "error",
  success: "success",
  info: "primary",
};

/**
 * Modal de confirmação reutilizável para ações críticas.
 *
 * Uso:
 * ```tsx
 * <ModalConfirm
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="Promover a Admin?"
 *   description="Esta ação concede acesso total ao painel administrativo."
 *   variant="warning"
 *   confirmLabel="Promover"
 *   loading={loading}
 *   error={error}
 *   onConfirm={handleConfirm}
 * />
 * ```
 */
export default function ModalConfirm({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "warning",
  loading = false,
  error,
  onConfirm,
}: ModalConfirmProps): React.JSX.Element {
  const color = variantColor[variant];

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderTop: 3,
            borderColor: `${color}.main`,
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{title}</DialogTitle>

      {(description || error) && (
        <DialogContent sx={{ pt: 0 }}>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: description ? 2 : 0 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
      )}

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          color="inherit"
          disabled={loading}
          sx={{ color: "text.secondary" }}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={color}
          disabled={loading}
          onClick={onConfirm}
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
