import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";

interface MemberOption { id: string; name: string; githubHandle: string; avatarUrl: string | null }
interface SubscriptionOption { id: string; amountCents: number; interval: "month"; currentPeriodEnd: string | null }
interface CompanyProfile {
  cnpj: string;
  name: string;
  tradeName: string;
  logoUrl: string;
  websiteUrl: string;
}
interface ExistingCompany extends CompanyProfile { id: string; responsibleMemberId: string; status: string }

const EMPTY_PROFILE: CompanyProfile = { cnpj: "", name: "", tradeName: "", logoUrl: "", websiteUrl: "" };
const memberLabel = (member: MemberOption) => `${member.name} (@${member.githubHandle})`;

export default function SubscriptionConversionPanel(): React.JSX.Element {
  const { authFetch } = useAuth();
  const [member, setMember] = useState<MemberOption | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionOption[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionOption | null>(null);
  const [companies, setCompanies] = useState<ExistingCompany[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [newCompany, setNewCompany] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [profileDirty, setProfileDirty] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await authFetch(`/mentorship/member-options?search=${encodeURIComponent(memberQuery.trim())}`);
        if (response.ok) setMemberResults((await response.json()) as MemberOption[]);
      } catch {
        setError("Não foi possível buscar membros.");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [authFetch, memberQuery]);

  const memberOptions = useMemo(() => {
    const options = new Map(memberResults.map((item) => [item.id, item]));
    if (member) options.set(member.id, member);
    return [...options.values()];
  }, [memberResults, member]);

  const selectMember = async (selected: MemberOption | null) => {
    setMember(selected);
    setSelectedSubscription(null);
    setSubscriptions([]);
    setCompanies([]);
    setCompanyId("");
    setNewCompany(false);
    setProfile(EMPTY_PROFILE);
    setProfileDirty(false);
    setConfirmed(false);
    setFeedback("");
    setError("");
    if (!selected) return;
    setLoading(true);
    try {
      const [subscriptionResponse, companyResponse] = await Promise.all([
        authFetch(`/companies/admin/personal-subscriptions?memberId=${encodeURIComponent(selected.id)}`),
        authFetch("/companies/admin/list?page=1&limit=100"),
      ]);
      if (!subscriptionResponse.ok || !companyResponse.ok) throw new Error("load failed");
      const subscriptionData = (await subscriptionResponse.json()) as SubscriptionOption[];
      const companyData = (await companyResponse.json()) as { items?: ExistingCompany[] };
      setSubscriptions(Array.isArray(subscriptionData) ? subscriptionData : []);
      const owned = (companyData.items ?? []).filter((company) => company.responsibleMemberId === selected.id);
      setCompanies(owned);
      if (owned.length === 1) {
        setCompanyId(owned[0].id);
        setProfile({
          cnpj: owned[0].cnpj,
          name: owned[0].name,
          tradeName: owned[0].tradeName ?? "",
          logoUrl: owned[0].logoUrl ?? "",
          websiteUrl: owned[0].websiteUrl ?? "",
        });
      } else if (owned.length === 0) {
        setNewCompany(true);
      }
    } catch {
      setError("Não foi possível carregar assinaturas e empresas do membro.");
    } finally {
      setLoading(false);
    }
  };

  const selectCompany = (id: string) => {
    setCompanyId(id);
    const company = companies.find((item) => item.id === id);
    if (!company) return;
    setProfile({
      cnpj: company.cnpj,
      name: company.name,
      tradeName: company.tradeName ?? "",
      logoUrl: company.logoUrl ?? "",
      websiteUrl: company.websiteUrl ?? "",
    });
    setProfileDirty(false);
  };

  const updateProfile = (field: keyof CompanyProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileDirty(true);
  };

  const saveProfile = async () => {
    if (!companyId) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await authFetch(`/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name,
          tradeName: profile.tradeName,
          logoUrl: profile.logoUrl,
          websiteUrl: profile.websiteUrl,
        }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível salvar os dados da empresa."));
        return;
      }
      setProfileDirty(false);
      setFeedback("Dados da empresa salvos. Revise a confirmação antes de converter.");
    } catch {
      setError("Não foi possível salvar os dados da empresa.");
    } finally {
      setSaving(false);
    }
  };

  const convert = async () => {
    if (!member || !selectedSubscription || !confirmed || (!newCompany && profileDirty)) return;
    if (newCompany && (!profile.name.trim() || !profile.cnpj.trim())) {
      setError("Informe nome legal e CNPJ da nova empresa.");
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await authFetch("/companies/admin/subscription-conversions", {
        method: "POST",
        body: JSON.stringify({
          memberId: member.id,
          subscriptionId: selectedSubscription.id,
          ...(newCompany ? {
            name: profile.name.trim(),
            cnpj: profile.cnpj.trim(),
            ...(profile.tradeName.trim() ? { tradeName: profile.tradeName.trim() } : {}),
            ...(profile.logoUrl.trim() ? { logoUrl: profile.logoUrl.trim() } : {}),
            ...(profile.websiteUrl.trim() ? { websiteUrl: profile.websiteUrl.trim() } : {}),
          } : { companyId }),
        }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível converter a assinatura."));
        return;
      }
      const result = (await response.json()) as { status: "converted" | "already_converted" };
      setFeedback(result.status === "converted"
        ? "Assinatura convertida sem nova cobrança. Empresa criada como pendente ou status existente preservado."
        : "A assinatura já estava convertida; nenhuma nova conversão foi criada.");
    } catch {
      setError("Não foi possível converter a assinatura.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2} component="form" onSubmit={(event) => event.preventDefault()}>
          <Box>
            <Typography variant="h5" component="h3">Converter assinatura pessoal em empresarial</Typography>
            <Typography color="text.secondary" variant="body2">A mesma assinatura Stripe é preservada. Nenhum checkout, cancelamento, refund ou crédito retroativo é criado.</Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {feedback && <Alert severity="success">{feedback}</Alert>}

          <Autocomplete
            value={member}
            options={memberOptions}
            getOptionLabel={memberLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => void selectMember(value)}
            onInputChange={(_, value) => setMemberQuery(value)}
            renderInput={(params) => <TextField {...params} label="Membro" helperText="Busque por nome ou handle." />}
          />

          {member && !loading && subscriptions.length === 0 && <Alert severity="info">Nenhuma assinatura pessoal mensal ativa encontrada.</Alert>}
          {subscriptions.map((subscription) => (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} key={subscription.id} sx={{ alignItems: { sm: "center" } }}>
              <Typography variant="body2">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subscription.amountCents / 100)} · mensal · {subscription.currentPeriodEnd ?? "período não informado"}
              </Typography>
              <Button variant="outlined" onClick={() => setSelectedSubscription(subscription)}>Usar esta assinatura</Button>
            </Stack>
          ))}
          {selectedSubscription && <Alert severity="info">Assinatura {selectedSubscription.id} selecionada. O ID e a cobrança serão mantidos.</Alert>}

          {selectedSubscription && companies.length > 1 && !newCompany && (
            <TextField label="Empresa existente" select value={companyId} onChange={(event) => selectCompany(event.target.value)}>
              {companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}
            </TextField>
          )}
          {selectedSubscription && companies.length > 0 && !newCompany && (
            <Button variant="text" onClick={() => { setNewCompany(true); setProfile(EMPTY_PROFILE); setProfileDirty(false); }}>Criar outra empresa</Button>
          )}
          {selectedSubscription && newCompany && companies.length > 0 && (
            <Button variant="text" onClick={() => { setNewCompany(false); selectCompany(companies[0].id); }}>Usar empresa existente</Button>
          )}

          {selectedSubscription && (
            <>
              <Typography variant="h6" component="h4">Dados da empresa</Typography>
              <TextField label="Nome legal" required value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} />
              <TextField label="CNPJ" required value={profile.cnpj} disabled={!newCompany} helperText={newCompany ? "Somente os 14 dígitos." : "CNPJ não muda na edição de perfil."} onChange={(event) => updateProfile("cnpj", event.target.value)} />
              <TextField label="Nome fantasia" value={profile.tradeName} onChange={(event) => updateProfile("tradeName", event.target.value)} />
              <TextField label="URL do logo" type="url" value={profile.logoUrl} onChange={(event) => updateProfile("logoUrl", event.target.value)} />
              <TextField label="Website" type="url" value={profile.websiteUrl} onChange={(event) => updateProfile("websiteUrl", event.target.value)} />
              {newCompany && <Alert severity="info">A empresa criada como pendente não ganha vitrine, selo ou badge automaticamente.</Alert>}
              {!newCompany && companyId && <Button variant="outlined" disabled={!profileDirty || saving} onClick={() => void saveProfile()}>Salvar dados da empresa</Button>}
              {profileDirty && !newCompany && <Alert severity="warning">Salve os dados da empresa antes de converter.</Alert>}
              <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label="Confirmo que a mesma assinatura será mantida, sem nova cobrança." />
              <Button variant="contained" disabled={saving || !confirmed || (!newCompany && profileDirty) || (!newCompany && !companyId)} onClick={() => void convert()}>Converter assinatura</Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
