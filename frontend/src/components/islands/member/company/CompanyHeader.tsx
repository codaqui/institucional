/**
 * Cabeçalho da empresa + dados cadastrais (leitura e edição inline) —
 * port de `CompanyHeader`, `CompanyInfo` e `CompanyEditForm`
 * (MyCompanySection, Docusaurus).
 *
 * O link do comprovante de doação recebe a URL completa via prop
 * (`receiptUrl`) — no Astro o `useAuth` prefixa a API_URL nas chamadas
 * autenticadas, mas o <a> precisa do absoluto.
 */
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import type { Company, CompanySupportSummary } from "./types";
import { formatCnpj } from "./types";
import SupportSummary from "./SupportSummary";

interface CompanyHeaderProps {
  readonly company: Company;
  readonly sortCoins: number;
}

export function CompanyHeader({ company, sortCoins }: CompanyHeaderProps): React.JSX.Element {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
      {company.logoUrl ? (
        <Avatar src={company.logoUrl} alt={company.name} sx={{ width: 48, height: 48 }} />
      ) : (
        <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
          <BusinessIcon />
        </Avatar>
      )}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
          {company.name}
        </Typography>
        {company.tradeName && (
          <Typography variant="body2" color="text.secondary">
            {company.tradeName}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          CNPJ: {formatCnpj(company.cnpj)} · Status: {company.status}
        </Typography>
      </Box>
      <Chip
        label={`${sortCoins} SortCoins`}
        color="primary"
        size="small"
        sx={{ fontWeight: 700 }}
      />
    </Box>
  );
}

interface CompanyEditFormProps {
  readonly editName: string;
  readonly setEditName: (value: string) => void;
  readonly editTradeName: string;
  readonly setEditTradeName: (value: string) => void;
  readonly editLogo: string;
  readonly setEditLogo: (value: string) => void;
  readonly editWebsite: string;
  readonly setEditWebsite: (value: string) => void;
  readonly saveError: string | null;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

export function CompanyEditForm({
  editName, setEditName,
  editTradeName, setEditTradeName,
  editLogo, setEditLogo,
  editWebsite, setEditWebsite,
  saveError, saving,
  onSave, onCancel,
}: CompanyEditFormProps): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <TextField label="Nome da empresa" value={editName} onChange={(e) => setEditName(e.target.value)} size="small" fullWidth />
      <TextField label="Nome fantasia" value={editTradeName} onChange={(e) => setEditTradeName(e.target.value)} size="small" fullWidth />
      <TextField label="URL do logotipo" value={editLogo} onChange={(e) => setEditLogo(e.target.value)} size="small" fullWidth />
      <TextField label="Website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} size="small" fullWidth />
      {saveError && <Alert severity="error">{saveError}</Alert>}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={onSave}
          disabled={saving}
        >
          Salvar
        </Button>
        <Button size="small" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </Box>
    </Stack>
  );
}

interface CompanyInfoProps {
  readonly company: Company;
  readonly supportSummary: CompanySupportSummary;
  readonly isOwner: boolean;
  readonly isActive: boolean;
  readonly receiptUrl: string;
  readonly onEdit: () => void;
}

export function CompanyInfo({
  company, supportSummary, isOwner, isActive, receiptUrl, onEdit,
}: CompanyInfoProps): React.JSX.Element {
  const hasConfiguredRecurring = isActive && (company.subscriptionAmountCents ?? 0) > 0;
  return (
    <Box sx={{ mb: 3, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {company.websiteUrl && (
        <Typography variant="body2">
          🌐{" "}
          <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer">
            {company.websiteUrl}
          </a>
        </Typography>
      )}
      {hasConfiguredRecurring ? (
        <Typography variant="body2" color="text.secondary">
          Recorrência configurada: R$ {(company.subscriptionAmountCents! / 100).toFixed(0)}/mês
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Recorrência configurada: inativa
        </Typography>
      )}
      <Button
        size="small"
        variant="text"
        href={receiptUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ alignSelf: "flex-start", textTransform: "none", mt: 0.5 }}
      >
        Baixar comprovante de doação
      </Button>
      <SupportSummary supportSummary={supportSummary} />
      <Button
        size="small"
        variant="outlined"
        startIcon={<EditIcon />}
        onClick={onEdit}
        sx={{ mt: 1, alignSelf: "flex-start", textTransform: "none" }}
        disabled={!isOwner || !isActive}
      >
        Editar dados
      </Button>
    </Box>
  );
}
