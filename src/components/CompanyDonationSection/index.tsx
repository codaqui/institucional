/**
 * CompanyDonationSection — fluxo de cadastro + checkout para CLUB Business.
 *
 * Passos:
 *  1. Formulário de cadastro da empresa (CNPJ, nome, logo, website)
 *  2. Stripe Embedded Checkout para assinatura mensal (R$ 200/mês mínimo)
 */

import React, { useCallback, useEffect, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { IdentityHandleChip, SupportPrimaryButton } from "../SupportCheckoutUi";
import StripeEmbeddedCheckoutDialog from "../StripeEmbeddedCheckoutDialog";
import { useAuth } from "../../hooks/useAuth";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const BUSINESS_TIERS = [
  {
    label: "R$ 200/mês",
    amountCents: 20_000,
    badge: null,
    perks: "Logo na página de Patrocinadores",
  },
  {
    label: "R$ 500/mês",
    amountCents: 50_000,
    badge: "Popular",
    perks: "Logo + destaque na homepage",
  },
  {
    label: "R$ 1.000/mês",
    amountCents: 100_000,
    badge: "Patrocinador",
    perks: "Logo + destaque + menção em eventos",
  },
  {
    label: "Personalizado",
    amountCents: 0,
    badge: null,
    perks: "Mínimo R$ 200/mês",
  },
] as const;

function formatCnpj(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function CompanyDonationSection({ onBack }: Readonly<{ onBack?: () => void }>) {
  const { siteConfig } = useDocusaurusContext();
  const stripeKey =
    (siteConfig.customFields?.stripePublishableKey as string) ?? "";

  const { user, ready, isLoggedIn, login, authFetch } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [existingCompany, setExistingCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Tier selection
  const [selectedTierIdx, setSelectedTierIdx] = useState(0);
  const [customAmountInput, setCustomAmountInput] = useState("");
  const selectedTier = BUSINESS_TIERS[selectedTierIdx];
  const isCustom = selectedTier.label === "Personalizado";
  const customAmountCents = isCustom
    ? Math.round(Number.parseFloat(customAmountInput.replace(",", ".")) * 100) || 0
    : 0;
  const finalAmountCents = isCustom
    ? customAmountCents
    : selectedTier.amountCents;

  // Form state
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Stripe checkout
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Fetch existing company for the logged-in user
  // When `onBack` is provided, the parent controls visibility — no need to gate on `expanded`
  useEffect(() => {
    if (!isLoggedIn) return;
    if (!expanded && !onBack) return;
    setLoadingCompany(true);
    authFetch("/companies/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Company | null) => {
        setExistingCompany(data);
        if (data) {
          setName(data.name);
          setCnpj(formatCnpj(data.cnpj));
          setLogoUrl(data.logoUrl ?? "");
          setWebsiteUrl(data.websiteUrl ?? "");
        }
        setLoadingCompany(false);
      })
      .catch(() => setLoadingCompany(false));
  }, [isLoggedIn, expanded, onBack, authFetch]);

  const handleRegisterOrProceed = useCallback(async () => {
    setFormError(null);

    // Validate tier amount
    if (finalAmountCents < 20_000) {
      setFormError("O valor mínimo é R$ 200,00/mês.");
      return;
    }

    setSubmitting(true);

    try {
      let company = existingCompany;

      if (!company) {
        // Register new company
        const rawCnpj = cnpj.replace(/\D/g, "");
        if (rawCnpj.length !== 14) {
          setFormError("CNPJ deve ter 14 dígitos.");
          setSubmitting(false);
          return;
        }
        if (!name.trim()) {
          setFormError("Razão social é obrigatória.");
          setSubmitting(false);
          return;
        }

        const res = await authFetch("/companies", {
          method: "POST",
          body: JSON.stringify({
            cnpj: rawCnpj,
            name: name.trim(),
            logoUrl: logoUrl.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError(
            (err as { message?: string }).message ?? "Erro ao cadastrar empresa.",
          );
          setSubmitting(false);
          return;
        }

        company = (await res.json()) as Company;
        setExistingCompany(company);
      }

      // Create company checkout session with selected amount
      const checkoutRes = await authFetch("/stripe/checkout-session/company", {
        method: "POST",
        body: JSON.stringify({
          companyId: company.id,
          subscriptionAmountCents: finalAmountCents,
        }),
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json().catch(() => ({}));
        setCheckoutError(
          (err as { message?: string }).message ??
            "Erro ao criar sessão de pagamento.",
        );
        setSubmitting(false);
        return;
      }

      const { clientSecret: secret } = (await checkoutRes.json()) as {
        clientSecret: string;
      };
      setClientSecret(secret);
      setCheckoutOpen(true);
    } catch {
      setFormError("Erro de conexão. Tente novamente.");
    }

    setSubmitting(false);
  }, [authFetch, cnpj, name, logoUrl, websiteUrl, existingCompany, finalAmountCents]);

  if (!expanded && !onBack) {
    return (
      <Card
        variant="outlined"
        sx={{
          mt: 4,
          borderRadius: 3,
          cursor: "pointer",
          "&:hover": { borderColor: "primary.main", boxShadow: 2 },
          transition: "all .2s",
        }}
        onClick={() => setExpanded(true)}
      >
        <CardContent
          sx={{ display: "flex", alignItems: "center", gap: 2, p: 3 }}
        >
          <BusinessIcon sx={{ fontSize: 40, color: "primary.main" }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Apoiar como Empresa (CLUB Business)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A partir de R$&nbsp;200/mês · CNPJ obrigatório · Visibilidade na página de
              Patrocinadores
            </Typography>
          </Box>
          <ExpandMoreIcon color="action" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <BusinessIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Apoiar como Empresa (CLUB Business)
            </Typography>
          </Box>
          {onBack ? (
            <Button
              size="small"
              onClick={onBack}
              startIcon={<ArrowBackIcon />}
              color="inherit"
            >
              Voltar
            </Button>
          ) : (
            <Button
              size="small"
              onClick={() => setExpanded(false)}
              startIcon={<ExpandLessIcon />}
              color="inherit"
            >
              Fechar
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Must be logged in */}
        {ready && !isLoggedIn && (
          <Alert
            severity="info"
            action={
              <Button
                onClick={() => login({ returnTo: "/participe/apoiar" })}
                size="small"
                variant="outlined"
              >
                Entrar com GitHub
              </Button>
            }
          >
            Você precisa estar logado para cadastrar sua empresa.
          </Alert>
        )}

        {ready && isLoggedIn && (
          <>
            {loadingCompany ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={2.5}>
                {existingCompany && (
                  <Alert
                    severity="success"
                    icon={<CheckCircleIcon fontSize="inherit" />}
                  >
                    Empresa <strong>{existingCompany.name}</strong> já cadastrada.
                    Você pode renovar ou ajustar o valor mensal.
                  </Alert>
                )}
                {checkoutSuccess && (
                  <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                    Pagamento confirmado com sucesso. Sua assinatura empresarial já está ativa.
                  </Alert>
                )}

                {user && (
                  <IdentityHandleChip
                    user={user}
                    labelPrefix="Apoiando como"
                    sx={{ width: "fit-content" }}
                  />
                )}

                <Box>
                  <Typography variant="overline" color="text.secondary" letterSpacing={1.2} sx={{ mb: 1, display: "block" }}>
                    Plano mensal
                  </Typography>
                  <ToggleButtonGroup
                    value={selectedTierIdx}
                    exclusive
                    onChange={(_, v) => { if (v !== null) setSelectedTierIdx(v as number); }}
                    sx={{ flexWrap: "wrap", gap: 1 }}
                  >
                    {BUSINESS_TIERS.map((tier, idx) => (
                      <ToggleButton
                        key={tier.label}
                        value={idx}
                        sx={{
                          px: 2, py: 1, textTransform: "none", fontWeight: 600,
                          position: "relative", flexDirection: "column", lineHeight: 1.3,
                          "&.Mui-selected": { bgcolor: "primary.main", color: "common.white" },
                        }}
                      >
                        {tier.badge && (
                          <Chip
                            label={tier.badge}
                            size="small"
                            color="warning"
                            sx={{
                              position: "absolute", top: -10, left: "50%",
                              transform: "translateX(-50%)", fontSize: "0.6rem",
                              height: 18, "& .MuiChip-label": { px: 0.8 },
                            }}
                          />
                        )}
                        <Box>{tier.label}</Box>
                        <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 400 }}>
                          {tier.perks}
                        </Typography>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  <Collapse in={isCustom}>
                    <TextField
                      label="Valor personalizado (R$/mês, mínimo R$ 200)"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value.replace(/[^0-9,.]/, ""))}
                      inputProps={{ inputMode: "decimal" }}
                      fullWidth
                      sx={{ mt: 2 }}
                      placeholder="200,00"
                      helperText="Mínimo R$ 200,00/mês."
                    />
                  </Collapse>
                </Box>

                <Divider />

                <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
                  Dados da empresa
                </Typography>
                <TextField
                  label="CNPJ"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  disabled={!!existingCompany}
                  inputProps={{ maxLength: 18 }}
                  fullWidth
                  required
                />
                <TextField
                  label="Razão social"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!existingCompany}
                  fullWidth
                  required
                />

                {!existingCompany && (
                  <>
                    <TextField
                      label="URL do logotipo (opcional)"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://minha-empresa.com.br/logo.png"
                      fullWidth
                    />
                    <TextField
                      label="Site da empresa (opcional)"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://minha-empresa.com.br"
                      fullWidth
                    />
                  </>
                )}

                {formError && <Alert severity="error">{formError}</Alert>}
                {checkoutError && <Alert severity="error">{checkoutError}</Alert>}

                <Typography variant="caption" color="text.disabled">
                  Responsável: {user?.name ?? user?.handle} ·{" "}
                  {isCustom
                    ? `Valor: R$ ${customAmountInput || "—"}/mês`
                    : selectedTier.label}{" "}
                  · Cancele a qualquer momento pelo portal Stripe.
                </Typography>

                <SupportPrimaryButton
                  label={existingCompany
                    ? `Apoiar com ${formatBRL(finalAmountCents / 100)}/mês`
                    : `Cadastrar empresa e apoiar com ${formatBRL(finalAmountCents / 100)}/mês`}
                  loading={submitting}
                  disabled={submitting}
                  onClick={handleRegisterOrProceed}
                  startIcon={<CreditCardIcon />}
                />
              </Stack>
            )}
          </>
        )}

        <StripeEmbeddedCheckoutDialog
          open={checkoutOpen}
          title="Finalizar apoio empresarial"
          stripeKey={stripeKey}
          clientSecret={clientSecret}
          onClose={() => setCheckoutOpen(false)}
          onComplete={() => {
            setCheckoutOpen(false);
            setCheckoutSuccess(true);
          }}
        />
      </CardContent>
    </Card>
  );
}
