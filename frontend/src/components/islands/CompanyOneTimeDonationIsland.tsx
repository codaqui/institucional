import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import MuiIslandProvider from "./MuiIslandProvider";
import StripeCheckoutDialog from "./StripeCheckoutDialog";
import { IdentityHandleChip } from "./support-ui";
import { useCompanyIdentity } from "./useCompanyIdentity";
import { DONATION_TARGETS, TESOURO } from "../../lib/donation-targets";
import { formatBRL, validateDonationAmount } from "../../lib/donation";
import { STRIPE_PUBLISHABLE_KEY } from "../../lib/config";
import { useAuth } from "../../lib/use-auth";

function CompanyOneTimeDonationSection() {
  const { user, ready, isLoggedIn, login, authFetch } = useAuth();
  const identity = useCompanyIdentity({ enabled: isLoggedIn, authFetch });
  const {
    existingCompany,
    loadingCompany,
    formError,
    cnpj,
    name,
    logoUrl,
    websiteUrl,
    setCnpj,
    setName,
    setLogoUrl,
    setWebsiteUrl,
    registerCompany,
  } = identity;
  const [target, setTarget] = useState(TESOURO.id);
  const [amountInput, setAmountInput] = useState("25,00");
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [status] = useState(() =>
    globalThis.window === undefined
      ? null
      : new URLSearchParams(globalThis.location.search).get("status"),
  );
  const [donationSuccess, setDonationSuccess] = useState(status === "success");
  const validation = validateDonationAmount(amountInput);
  const amountError = amountTouched ? validation.error : null;
  const cnpjInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const donate = async () => {
    setAmountTouched(true);
    setCheckoutError(null);
    if (validation.error || validation.cents === null) return;

    setSubmitting(true);
    let company: Awaited<ReturnType<typeof registerCompany>>;
    try {
      company = await registerCompany();
    } catch {
      if (cnpj.replace(/\D/g, "").length !== 14) cnpjInputRef.current?.focus();
      else nameInputRef.current?.focus();
      setSubmitting(false);
      return;
    }

    try {
      const response = await authFetch("/stripe/checkout-session/company/one-time", {
        method: "POST",
        body: JSON.stringify({
          companyId: company.id,
          amount: validation.cents,
          communityId: target,
          uiMode: "embedded_page",
          returnPath: "/participe/apoiar?modo=empresa&apoio=unica",
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        setCheckoutError(body.message ?? "Erro ao criar sessão de pagamento.");
        return;
      }
      const data = await response.json() as { clientSecret?: string };
      if (!data.clientSecret) {
        setCheckoutError("Resposta de pagamento inesperada.");
        return;
      }
      setClientSecret(data.clientSecret);
      setCheckoutOpen(true);
    } catch (error) {
      if (!formError) {
        setCheckoutError(error instanceof Error ? error.message : "Erro de conexão. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
          <BusinessIcon color="primary" />
          <Typography id="company-one-time-title" variant="h5" component="h2" sx={{ fontWeight: 800 }}>
            Doação única da empresa
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Contribua para a Codaqui ou uma comunidade Integrada. Esta doação não é
          patrocínio e não concede visibilidade, selo, SortCoins ou outros benefícios.
        </Typography>

        {status === "cancelled" && (
          <Alert severity="info" sx={{ mb: 2 }}>O pagamento foi cancelado. Seus dados continuam preenchidos.</Alert>
        )}
        {donationSuccess && (
          <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} sx={{ mb: 2 }}>
            Doação confirmada. Obrigado por apoiar esta causa. O recibo estará disponível em Minhas doações e na transparência.
          </Alert>
        )}
        {ready && !isLoggedIn && (
          <Alert
            severity="info"
            action={(
              <Button
                onClick={() => login({ returnTo: "/participe/apoiar?modo=empresa&apoio=unica" })}
                size="small"
                variant="outlined"
              >
                Entrar com GitHub
              </Button>
            )}
          >
            Você precisa estar logado para cadastrar sua empresa e doar.
          </Alert>
        )}

        {ready && isLoggedIn && (
          <>
            {loadingCompany ? (
              <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress size={28} /></Box>
            ) : (
              <Box component="form" noValidate aria-labelledby="company-one-time-title" onSubmit={(event) => {
                event.preventDefault();
                void donate();
              }}>
                <Stack spacing={2.5}>
                  {existingCompany && (
                    <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                      Empresa <strong>{existingCompany.name}</strong> já cadastrada. A doação única não altera seu status ou benefícios.
                    </Alert>
                  )}
                  {user && <IdentityHandleChip user={user} labelPrefix="Apoiando como" sx={{ width: "fit-content" }} />}

                  <FormControl fullWidth required>
                    <InputLabel id="company-target-label">Destino da doação</InputLabel>
                    <Select
                      labelId="company-target-label"
                      label="Destino da doação"
                      name="communityId"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      {DONATION_TARGETS.map((item) => (
                        <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Valor da doação (R$)"
                    name="amount"
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    onBlur={() => setAmountTouched(true)}
                    required
                    fullWidth
                    error={Boolean(amountError)}
                    helperText={amountError ?? "Pagamento único. O mínimo da assinatura não se aplica."}
                    slotProps={{
                      htmlInput: {
                        inputMode: "decimal",
                        "aria-invalid": Boolean(amountError),
                        "aria-describedby": amountError ? "company-amount-error" : undefined,
                      },
                    }}
                  />
                  {amountError && <span id="company-amount-error" hidden>{amountError}</span>}

                  <Divider />
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
                    Dados da empresa
                  </Typography>
                  <TextField
                    label="CNPJ"
                    name="cnpj"
                    inputRef={cnpjInputRef}
                    value={cnpj}
                    onChange={(event) => setCnpj(event.target.value)}
                    placeholder="00.000.000/0000-00"
                    disabled={!!existingCompany}
                    required
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 18 } }}
                  />
                  <TextField
                    label="Razão social"
                    name="name"
                    inputRef={nameInputRef}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!!existingCompany}
                    required
                    fullWidth
                  />
                  {!existingCompany && (
                    <>
                      <TextField
                        label="URL do logotipo (opcional)"
                        name="logoUrl"
                        value={logoUrl}
                        onChange={(event) => setLogoUrl(event.target.value)}
                        fullWidth
                      />
                      <TextField
                        label="Site da empresa (opcional)"
                        name="websiteUrl"
                        value={websiteUrl}
                        onChange={(event) => setWebsiteUrl(event.target.value)}
                        fullWidth
                      />
                    </>
                  )}

                  {formError && <Alert severity="error">{formError}</Alert>}
                  {checkoutError && <Alert severity="error">{checkoutError}</Alert>}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CreditCardIcon />}
                    sx={{ textTransform: "none", fontWeight: 700, py: 1.5 }}
                  >
                    {submitting
                      ? "Criando checkout…"
                      : validation.cents === null
                        ? "Doar"
                        : `Doar ${formatBRL(validation.cents / 100)}`}
                  </Button>
                </Stack>
              </Box>
            )}
          </>
        )}

        <StripeCheckoutDialog
          open={checkoutOpen}
          title="Finalizar doação única da empresa"
          stripeKey={STRIPE_PUBLISHABLE_KEY}
          clientSecret={clientSecret}
          onClose={() => setCheckoutOpen(false)}
          onComplete={() => {
            setCheckoutOpen(false);
            setDonationSuccess(true);
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function CompanyOneTimeDonationIsland() {
  return (
    <MuiIslandProvider>
      <CompanyOneTimeDonationSection />
    </MuiIslandProvider>
  );
}
