import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";

interface AdminLoadFeedbackProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  itemLabel?: string;
}

export default function AdminLoadFeedback({
  loading = false,
  error = null,
  onRetry,
  itemLabel = "dados administrativos",
}: Readonly<AdminLoadFeedbackProps>) {
  if (loading) {
    return (
      <Box role="status" aria-label={`Carregando ${itemLabel}`} sx={{ py: 2 }}>
        <Skeleton variant="rectangular" height={120} />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Tentar novamente</Button> : undefined}
      >
        {error}
      </Alert>
    );
  }
  return null;
}
