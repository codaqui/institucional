/**
 * Dashboard do membro (`/membro`) — port de `src/pages/membro/index.tsx`
 * (Docusaurus, 1.663 linhas) decomposto em abas na pasta `dashboard/`.
 *
 * Diferenças para o original: `authFetch` recebe path (o useAuth do Astro
 * prefixa API_URL), o guard usa `location.replace` e o `Link` do Docusaurus
 * virou `<a>` nativo nas sub-árvores.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CancelIcon from "@mui/icons-material/Cancel";
import PrintIcon from "@mui/icons-material/Print";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ScheduleIcon from "@mui/icons-material/Schedule";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../../admin/ui/PageContainer";
import TabPanel from "../../admin/ui/TabPanel";
import ModalConfirm from "../../admin/ui/ModalConfirm";
import { useAuth } from "../../../../lib/use-auth";
import { API_URL } from "../../../../lib/config";
import {
  buildMemberHref,
  memberSectionFromSearchParams,
} from "../../../../lib/member-navigation";
import type { MemberSection } from "../../../../lib/member-navigation";
import { formatBRL, parseBrlInput } from "../../../../lib/transaction";
import type { CommunityBalance } from "../../../../lib/transaction";
import { MemberProfileCard } from "./MemberHeader";
import OverviewTab from "./OverviewTab";
import MyDataTab from "../privacy/MyDataTab";
import DonationsTab from "./DonationsTab";
import SubscriptionsTab from "./SubscriptionsTab";
import WalletTab from "./WalletTab";
import EventsTab from "./EventsTab";
import CertificateCard from "./CertificateCard";
import MemberProjectsIsland from "../../projects/MemberProjectsIsland";
import MentorProjectsIsland from "../../projects/MentorProjectsIsland";
import type {
  CertificateData,
  Donation,
  EventRegistration,
  EventsSubTab,
  PaginatedResponse,
  ReimbursementRequest,
  Subscription,
} from "./types";
import { isUpcomingEvent } from "./types";

type ParticipationTab = "events" | "projects";
type FinanceTab = "donations" | "subscriptions" | "wallet";

const SECTION_INDEX: Record<MemberSection, number> = {
  overview: 0,
  participation: 1,
  finance: 2,
  account: 3,
};

function MemberDashboardInner() {
  const { user, ready, isLoggedIn, isAdmin, isFinanceAnalyzer, authFetch } = useAuth();

  const [donations, setDonations] = useState<Donation[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [donationsPage, setDonationsPage] = useState(1);
  const [donationsTotal, setDonationsTotal] = useState(0);
  const [donationsLimit] = useState(10);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsPage, setSubsPage] = useState(1);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsLimit] = useState(10);
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>([]);
  const [reimbLoading, setReimbLoading] = useState(true);
  const [accounts, setAccounts] = useState<CommunityBalance[]>([]);

  const [reimbDialog, setReimbDialog] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeSection, setActiveSection] = useState<MemberSection>("overview");
  const [participationTab, setParticipationTab] = useState<ParticipationTab>("events");
  const [financeTab, setFinanceTab] = useState<FinanceTab>("donations");
  const [eventsSubTab, setEventsSubTab] = useState<EventsSubTab>("future");
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // ── Histórico de eventos (dados sob demanda — só carrega ao abrir a aba) ──
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regsLoaded, setRegsLoaded] = useState(false);
  const [regsError, setRegsError] = useState("");
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);
  const [cancelRegId, setCancelRegId] = useState<string | null>(null);
  const [cancelRegLoading, setCancelRegLoading] = useState(false);
  const [cancelRegError, setCancelRegError] = useState("");
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [certLoadingId, setCertLoadingId] = useState<string | null>(null);
  const [certError, setCertError] = useState("");

  const origin = globalThis.window === undefined ? "" : globalThis.location.origin;

  const groupedRegistrations = useMemo(() => {
    const future: EventRegistration[] = [];
    const purchased: EventRegistration[] = [];
    const history: EventRegistration[] = [];
    for (const reg of registrations) {
      if (!reg) continue;
      const isOwn = reg.memberId === user?.sub;
      const isPast =
        !isUpcomingEvent(reg) ||
        reg.checkedInAt ||
        reg.status === "cancelled" ||
        reg.status === "refunded";
      if (reg.isPayerOnly || (!isOwn && reg.payerMemberId === user?.sub)) {
        // ingresso comprado pelo usuário para outra pessoa
        if (isPast) history.push(reg);
        else purchased.push(reg);
      } else if (isPast) {
        history.push(reg);
      } else {
        future.push(reg);
      }
    }
    return { future, purchased, history };
  }, [registrations, user]);

  const fetchReimbursements = useCallback(() => {
    setReimbLoading(true);
    authFetch("/reimbursements/my")
      .then((r) => r.json())
      .then((data) => setReimbursements(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setReimbLoading(false));
  }, [authFetch]);

  const fetchRegistrations = useCallback(() => {
    setRegsLoading(true);
    setRegsError("");
    authFetch("/events/my-registrations")
      .then(async (r) => {
        if (!r.ok) {
          setRegsError("Não foi possível carregar suas inscrições em eventos.");
          return;
        }
        const data = await r.json();
        setRegistrations(Array.isArray(data) ? data : []);
      })
      .catch(() => setRegsError("Erro inesperado ao carregar inscrições."))
      .finally(() => {
        setRegsLoading(false);
        setRegsLoaded(true);
      });
  }, [authFetch]);

  useEffect(() => {
    if (
      activeSection === "participation" &&
      participationTab === "events" &&
      !regsLoaded &&
      !regsLoading
    ) {
      fetchRegistrations();
    }
  }, [activeSection, participationTab, regsLoaded, regsLoading, fetchRegistrations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const location = memberSectionFromSearchParams(window.location.search);
    setActiveSection(location.section);
    if (location.section === "participation") {
      setParticipationTab(location.tab === "projects" ? "projects" : "events");
      if (location.tab === "future" || location.tab === "history") {
        setEventsSubTab(location.tab);
      }
    }
    if (
      location.section === "finance" &&
      (location.tab === "donations" ||
        location.tab === "subscriptions" ||
        location.tab === "wallet")
    ) {
      setFinanceTab(location.tab);
    }
    if (search.get("purchase") === "success") setPurchaseSuccess(true);

    const next = new URL(window.location.href);
    next.search = buildMemberHref(location.section, location.tab);
    window.history.replaceState({}, "", next.toString());
  }, []);

  const updateMemberLocation = (section: MemberSection, tab?: string) => {
    const next = new URL(window.location.href);
    next.search = buildMemberHref(section, tab);
    window.history.replaceState({}, "", next.toString());
  };

  const selectSection = (section: MemberSection) => {
    setActiveSection(section);
    updateMemberLocation(section);
  };

  const selectParticipationTab = (tab: ParticipationTab) => {
    setParticipationTab(tab);
    updateMemberLocation("participation", tab === "projects" ? "projects" : eventsSubTab);
  };

  const selectFinanceTab = (tab: FinanceTab) => {
    setFinanceTab(tab);
    updateMemberLocation("finance", tab);
  };

  const selectEventsSubTab = (tab: EventsSubTab) => {
    setEventsSubTab(tab);
    updateMemberLocation("participation", tab);
  };

  const handleCancelRegistration = async () => {
    if (!cancelRegId) return;
    setCancelRegLoading(true);
    setCancelRegError("");
    try {
      const res = await authFetch(`/events/registrations/${cancelRegId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCancelRegError(data?.message ?? "Erro ao cancelar inscrição.");
        return;
      }
      setCancelRegId(null);
      fetchRegistrations();
    } catch {
      setCancelRegError("Erro inesperado ao cancelar inscrição.");
    } finally {
      setCancelRegLoading(false);
    }
  };

  const handleEmitCertificate = async (registrationId: string) => {
    setCertLoadingId(registrationId);
    setCertError("");
    try {
      const res = await authFetch(`/events/registrations/${registrationId}/certificate`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCertError(
          data?.message ??
            (res.status === 403
              ? "O certificado não está disponível para esta inscrição."
              : "Erro ao abrir certificado."),
        );
        return;
      }
      setCertificate((await res.json()) as CertificateData);
    } catch {
      setCertError("Erro inesperado ao emitir certificado.");
    } finally {
      setCertLoadingId(null);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }

    // Doações via Stripe
    authFetch(`/stripe/my-donations?page=${donationsPage}&limit=${donationsLimit}`)
      .then((r) => r.json())
      .then((data: PaginatedResponse<Donation> | Donation[]) => {
        if (Array.isArray(data)) {
          setDonations(data);
          setDonationsTotal(data.length);
          return;
        }
        setDonations(Array.isArray(data.items) ? data.items : []);
        setDonationsTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));

    // Assinaturas recorrentes
    authFetch(`/stripe/my-subscriptions?page=${subsPage}&limit=${subsLimit}`)
      .then((r) => r.json())
      .then((data: PaginatedResponse<Subscription> | Subscription[]) => {
        if (Array.isArray(data)) {
          setSubscriptions(data);
          setSubsTotal(data.length);
          return;
        }
        setSubscriptions(Array.isArray(data.items) ? data.items : []);
        setSubsTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setSubsLoading(false));

    // Reembolsos
    fetchReimbursements();

    // Contas disponíveis para reembolso
    fetch(`${API_URL}/ledger/community-balances`)
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [
    ready,
    isLoggedIn,
    authFetch,
    fetchReimbursements,
    donationsPage,
    donationsLimit,
    subsPage,
    subsLimit,
  ]);

  const handleSubmitReimbursement = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const parsedAmount = parseBrlInput(amount);
      if (parsedAmount === null || parsedAmount <= 0) {
        setSubmitError("Informe um valor válido maior que zero.");
        return;
      }
      const res = await authFetch("/reimbursements", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: parsedAmount,
          description,
          receiptUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.message ?? "Erro ao enviar solicitação.");
        return;
      }
      setReimbDialog(false);
      setAccountId("");
      setAmount("");
      setDescription("");
      setReceiptUrl("");
      fetchReimbursements();
    } catch {
      setSubmitError("Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelSubId) return;
    setCancelling(true);
    try {
      const res = await authFetch(`/stripe/subscriptions/${cancelSubId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao cancelar assinatura.");
      // Atualiza estado local — marca como cancelAtPeriodEnd
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === cancelSubId ? { ...s, cancelAtPeriodEnd: true } : s)),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(false);
      setCancelSubId(null);
    }
  };

  useEffect(() => {
    const beforePrint = () => setIsPrinting(true);
    const afterPrint = () => setIsPrinting(false);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);

  if (!ready || !isLoggedIn) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageContainer sx={{ maxWidth: "md" }}>
      <MemberProfileCard user={user!} />

      <Tabs
        value={SECTION_INDEX[activeSection]}
        onChange={(_, value: number) => {
          const section = (Object.keys(SECTION_INDEX) as MemberSection[]).find(
            (key) => SECTION_INDEX[key] === value,
          );
          if (section) selectSection(section);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Seções do perfil"
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Visão geral" />
        <Tab label="Participação" />
        <Tab label="Financeiro" />
        <Tab label="Conta e privacidade" />
      </Tabs>

      <TabPanel value={SECTION_INDEX[activeSection]} index={0}>
        <OverviewTab
          donations={donations}
          txLoading={txLoading}
          subscriptions={subscriptions}
          subsLoading={subsLoading}
          reimbursements={reimbursements}
          reimbLoading={reimbLoading}
          onOpenDonationsTab={() => {
            selectSection("finance");
            selectFinanceTab("donations");
          }}
          onOpenSubscriptionsTab={() => {
            selectSection("finance");
            selectFinanceTab("subscriptions");
          }}
          onOpenWalletTab={() => {
            selectSection("finance");
            selectFinanceTab("wallet");
            setReimbDialog(true);
            setSubmitError("");
          }}
        />
      </TabPanel>

      <TabPanel value={SECTION_INDEX[activeSection]} index={1}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <Button
            component="a"
            href="/membro/horas"
            variant="outlined"
            startIcon={<ScheduleIcon />}
          >
            Minhas horas
          </Button>
        </Box>
        <Tabs
          value={participationTab}
          onChange={(_, value: ParticipationTab) => selectParticipationTab(value)}
          aria-label="Áreas de participação"
          sx={{ mb: 2 }}
        >
          <Tab value="events" label="Eventos" />
          <Tab value="projects" label="Projetos" />
        </Tabs>
        <TabPanel value={participationTab} index="events">
          <EventsTab
            purchaseSuccess={purchaseSuccess}
            setPurchaseSuccess={setPurchaseSuccess}
            regsError={regsError}
            regsLoading={regsLoading}
            regsLoaded={regsLoaded}
            registrations={registrations}
            groupedRegistrations={groupedRegistrations}
            eventsSubTab={eventsSubTab}
            setEventsSubTab={selectEventsSubTab}
            expandedQrId={expandedQrId}
            setExpandedQrId={setExpandedQrId}
            certLoadingId={certLoadingId}
            certError={certError}
            setCertError={setCertError}
            onEmitCertificate={handleEmitCertificate}
            onCancel={(id) => {
              setCancelRegId(id);
              setCancelRegError("");
            }}
            userName={user?.name}
          />
        </TabPanel>
        <TabPanel value={participationTab} index="projects">
          <MemberProjectsIsland />
          <MentorProjectsIsland />
        </TabPanel>
      </TabPanel>

      <TabPanel value={SECTION_INDEX[activeSection]} index={2}>
        <Tabs
          value={financeTab}
          onChange={(_, value: FinanceTab) => selectFinanceTab(value)}
          aria-label="Áreas financeiras"
          variant="scrollable"
          sx={{ mb: 2 }}
        >
          <Tab value="donations" label="Doações" />
          <Tab value="subscriptions" label="Assinaturas" />
          <Tab value="wallet" label="SortCoins e reembolsos" />
        </Tabs>
        <TabPanel value={financeTab} index="donations">
          <DonationsTab
            loading={txLoading}
            donations={donations}
            page={donationsPage}
            total={donationsTotal}
            limit={donationsLimit}
            onPageChange={setDonationsPage}
          />
        </TabPanel>
        <TabPanel value={financeTab} index="subscriptions">
          <SubscriptionsTab
            loading={subsLoading}
            subscriptions={subscriptions}
            page={subsPage}
            total={subsTotal}
            limit={subsLimit}
            onPageChange={setSubsPage}
            onCancelClick={setCancelSubId}
          />
        </TabPanel>
        <TabPanel value={financeTab} index="wallet">
          {(isAdmin || isFinanceAnalyzer) && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <Button variant="outlined" size="small" color="secondary" href="/admin/reembolsos">
                Painel de Reembolsos
              </Button>
            </Box>
          )}
          <WalletTab
            loading={reimbLoading}
            reimbursements={reimbursements}
            onRequestReimbursement={() => {
              setReimbDialog(true);
              setSubmitError("");
            }}
          />
        </TabPanel>
      </TabPanel>

      <TabPanel value={SECTION_INDEX[activeSection]} index={3}>
        <MyDataTab />
      </TabPanel>

      {/* ── Dialog: Confirmar cancelamento de assinatura ── */}
      <Dialog
        open={!!cancelSubId}
        onClose={() => !cancelling && setCancelSubId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
          <CancelIcon color="error" />
          Cancelar assinatura?
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            A assinatura <strong>não será cancelada imediatamente</strong>. Ela continuará ativa
            até o final do período já pago e só então será encerrada.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Você pode criar uma nova assinatura a qualquer momento em <strong>/participe/apoiar</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelSubId(null)} disabled={cancelling} color="inherit">
            Manter assinatura
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={cancelling}
            onClick={handleCancelSubscription}
            startIcon={cancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
          >
            {cancelling ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reimbursement Dialog ── */}
      <Dialog open={reimbDialog} onClose={() => setReimbDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Solicitar Reembolso</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            <Alert severity="info">
              O comprovante deve ser uma URL pública (Google Drive, Dropbox etc.). Após a
              aprovação, ele será arquivado internamente pela equipe financeira.
            </Alert>

            <FormControl fullWidth required>
              <InputLabel>Conta (carteira comunitária)</InputLabel>
              <Select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                label="Conta (carteira comunitária)"
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({formatBRL(a.balance)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Valor (R$)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            />

            <TextField
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              multiline
              rows={2}
              placeholder="Ex: Compra de materiais para o evento de outubro"
            />

            <TextField
              label="URL do comprovante (obrigatório)"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
              placeholder="https://drive.google.com/file/d/..."
              type="url"
              helperText="Use um link público para que a equipe financeira possa verificar."
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReimbDialog(false)} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={
              !accountId || !amount || !description.trim() || !receiptUrl.trim() || submitting
            }
            onClick={handleSubmitReimbursement}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ReceiptLongIcon />}
          >
            Enviar Solicitação
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Cancelar inscrição em evento ── */}
      <ModalConfirm
        open={!!cancelRegId}
        title="Cancelar inscrição?"
        description="Sua inscrição no evento será cancelada. Se o ingresso foi pago, o estorno segue a política do evento."
        variant="error"
        confirmLabel="Cancelar inscrição"
        loading={cancelRegLoading}
        error={cancelRegError}
        onConfirm={handleCancelRegistration}
        onClose={() => setCancelRegId(null)}
      />

      {/* ── Certificado de participação (imprimível) ── */}
      <Dialog open={!!certificate} onClose={() => setCertificate(null)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          {certificate && <CertificateCard certificate={certificate} origin={origin} />}
        </DialogContent>
        <DialogActions className="no-print" sx={{ justifyContent: "center", pb: 2, gap: 1 }}>
          <Button onClick={() => setCertificate(null)} color="inherit">
            Fechar
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => globalThis.print()}>
            Imprimir / salvar PDF
          </Button>
        </DialogActions>
      </Dialog>
      {isPrinting && certificate && <Box className="print-certificate" aria-hidden={true}><CertificateCard certificate={certificate} origin={origin} /></Box>}
    </PageContainer>
  );
}

export default function MemberDashboardApp() {
  return (
    <MuiIslandProvider>
      <MemberDashboardInner />
    </MuiIslandProvider>
  );
}
