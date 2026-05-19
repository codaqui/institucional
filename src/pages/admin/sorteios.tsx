import React, { useCallback, useEffect, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AdminNavbar from "../../components/AdminNavbar";
import AdminPageContainer from "../../components/AdminPageContainer";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";

type RaffleStatus = "open" | "closed" | "drawn" | "canceled";

interface Raffle {
  id: string;
  title: string;
  description: string | null;
  costInCoins: number;
  status: RaffleStatus;
  closesAt: string;
  drawAt: string | null;
  winnerId: string | null;
  winnerDisplay?: string | null;
  participantCount?: number;
  totalCoinsGenerated?: number;
  drawSeed?: string | null;
  drawAlgorithm?: string | null;
  algorithmCodeUrl?: string;
}

interface RaffleEntry {
  id: string;
  ownerType: "member" | "company";
  ownerDisplay: string;
  enteredAt: string;
  coinsSpent: number;
}

const STATUS_LABEL: Record<RaffleStatus, string> = {
  open: "Aberto",
  closed: "Fechado",
  drawn: "Sorteado",
  canceled: "Cancelado",
};

const STATUS_COLOR: Record<RaffleStatus, "success" | "warning" | "info" | "default"> = {
  open: "success",
  closed: "warning",
  drawn: "info",
  canceled: "default",
};

function parseDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const parsed = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    0,
    0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function AdminSorteiosPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const [entriesCache, setEntriesCache] = useState<Record<string, RaffleEntry[]>>({});
  const [entriesLoading, setEntriesLoading] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    costInCoins: "",
    closesAt: "",
  });

  const fetchRaffles = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const res = await authFetch(`${apiUrl}/club/raffles/all`);
    const data = await parseAuthJson<Raffle[]>(res, setLoadError);
    if (data) {
      setRaffles(data);
    }
    setLoading(false);
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.replace("/");
      return;
    }
    fetchRaffles();
  }, [ready, isLoggedIn, isAdmin, history, fetchRaffles]);

  const createRaffle = async () => {
    setSubmitting(true);
    setActionError("");
    try {
      const cost = Number.parseInt(form.costInCoins, 10);
      if (!form.title.trim()) {
        setActionError("Informe o título do sorteio.");
        setSubmitting(false);
        return;
      }
      if (Number.isNaN(cost) || cost <= 0) {
        setActionError("Informe um custo em SortCoins maior que zero.");
        setSubmitting(false);
        return;
      }
      if (!form.closesAt) {
        setActionError("Informe a data/hora de encerramento.");
        setSubmitting(false);
        return;
      }
      const closesAtDate = parseDateTimeLocal(form.closesAt);
      if (!closesAtDate) {
        setActionError("Data/hora de encerramento inválida.");
        setSubmitting(false);
        return;
      }

      const res = await authFetch(`${apiUrl}/club/raffles`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          costInCoins: cost,
          closesAt: closesAtDate.toISOString(),
        }),
      });

      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Não foi possível criar o sorteio."));
        setSubmitting(false);
        return;
      }

      setForm({ title: "", description: "", costInCoins: "", closesAt: "" });
      await fetchRaffles();
    } catch {
      setActionError("Erro inesperado ao criar sorteio.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEntries = async (raffleId: string) => {
    const currentlyOpen = expandedEntries[raffleId] ?? false;
    setExpandedEntries((prev) => ({ ...prev, [raffleId]: !currentlyOpen }));
    if (currentlyOpen || entriesCache[raffleId] || entriesLoading[raffleId]) return;

    setEntriesLoading((prev) => ({ ...prev, [raffleId]: true }));
    const res = await authFetch(`${apiUrl}/club/raffles/${raffleId}/entries`);
    const data = await parseAuthJson<RaffleEntry[]>(res, setActionError);
    if (data) {
      setEntriesCache((prev) => ({ ...prev, [raffleId]: data }));
    }
    setEntriesLoading((prev) => ({ ...prev, [raffleId]: false }));
  };

  const drawRaffle = async (raffleId: string) => {
    setActionError("");
    const res = await authFetch(`${apiUrl}/club/raffles/${raffleId}/draw`, { method: "POST" });
    if (!res.ok) {
      setActionError(await extractErrorMessage(res, "Não foi possível sortear vencedor."));
      return;
    }
    await fetchRaffles();
  };

  const cancelRaffle = async (raffleId: string) => {
    setActionError("");
    const res = await authFetch(`${apiUrl}/club/raffles/${raffleId}`, { method: "DELETE" });
    if (!res.ok) {
      setActionError(await extractErrorMessage(res, "Não foi possível cancelar sorteio."));
      return;
    }
    await fetchRaffles();
  };

  if (!ready || !isLoggedIn || !isAdmin) {
    return (
      <Layout title="Admin — Sorteios">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Admin — Sorteios" description="Gestão de sorteios do Clube Codaqui">
      <AdminPageContainer>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              <EmojiEventsIcon sx={{ mr: 1, verticalAlign: "middle" }} />
              Sorteios
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Crie, sorteie e cancele sorteios do Clube Codaqui.
            </Typography>
          </Box>
          <Button variant="outlined" href="/clube">
            Ver página pública do Clube
          </Button>
        </Box>

        <AdminNavbar active="/admin/sorteios" />

        {(loadError || actionError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError || actionError}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Novo sorteio
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Título"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Descrição (opcional)"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  label="Custo (SortCoins)"
                  type="number"
                  value={form.costInCoins}
                  onChange={(event) => setForm((prev) => ({ ...prev, costInCoins: event.target.value }))}
                  inputProps={{ min: 1 }}
                />
                <TextField
                  label="Encerra em"
                  type="datetime-local"
                  value={form.closesAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, closesAt: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box>
                <Button variant="contained" onClick={createRaffle} disabled={submitting}>
                  Criar sorteio
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
             {raffles.map((raffle) => {
                const raffleEntries = entriesCache[raffle.id] ?? [];
                const totalCoins = raffle.totalCoinsGenerated ?? raffleEntries.reduce((sum, entry) => sum + entry.coinsSpent, 0);
               return (
               <Card key={raffle.id} variant="outlined">
                 <CardContent>
                   {/* Header row: title + status chip */}
                   <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1 }}>
                     <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
                       {raffle.title}
                     </Typography>
                     <Chip label={STATUS_LABEL[raffle.status]} color={STATUS_COLOR[raffle.status]} size="small" sx={{ flexShrink: 0 }} />
                   </Box>
                   {raffle.description && (
                     <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                       {raffle.description}
                     </Typography>
                   )}
                   <Typography variant="caption" color="text.secondary" display="block">
                     Custo: {raffle.costInCoins} SortCoins · Encerra em {new Date(raffle.closesAt).toLocaleString("pt-BR")}
                   </Typography>
                   <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                     Investimento total: {totalCoins} SortCoins
                   </Typography>
                   {raffle.status === "drawn" && (
                     <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                       Vencedor: {raffle.winnerDisplay ?? raffle.winnerId ?? "—"}
                     </Typography>
                   )}
                   {raffle.status === "drawn" && raffle.drawSeed && (
                     <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                       Seed: {raffle.drawSeed} · Algoritmo: {raffle.drawAlgorithm}
                     </Typography>
                   )}
                   {/* Action bar — full width, no overlap */}
                   <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap", alignItems: "center" }}>
                     <Button size="small" variant="text" sx={{ px: 0 }} onClick={() => toggleEntries(raffle.id)}>
                       {(expandedEntries[raffle.id] ? "Ocultar" : "Ver") + " participantes"}
                     </Button>
                     {raffle.status === "drawn" && raffle.algorithmCodeUrl && (
                       <Button size="small" variant="text" sx={{ px: 0 }} href={raffle.algorithmCodeUrl} target="_blank" rel="noopener noreferrer">
                         Ver código do sorteio
                       </Button>
                     )}
                     {(raffle.status === "open" || raffle.status === "closed") && (
                       <>
                         <Button size="small" variant="contained" onClick={() => drawRaffle(raffle.id)}>
                           Sortear
                         </Button>
                         <Button size="small" variant="outlined" color="error" onClick={() => cancelRaffle(raffle.id)}>
                           Cancelar
                         </Button>
                       </>
                     )}
                   </Box>
                  {(expandedEntries[raffle.id] ?? false) && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                      {entriesLoading[raffle.id] ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                          <CircularProgress size={18} />
                        </Box>
                      ) : (
                        <Stack spacing={1}>
                          {raffleEntries.map((entry) => {
                            const chance = totalCoins > 0 ? (entry.coinsSpent / totalCoins) * 100 : 0;
                            return (
                            <Box
                              key={entry.id}
                              sx={{
                                p: 1.25,
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                                flexWrap: "wrap",
                              }}
                            >
                              <Typography variant="body2" fontWeight={600}>
                                {entry.ownerDisplay}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
                                {entry.coinsSpent} SortCoins · {chance.toFixed(2)}%{" "}
                                ({entry.ownerType === "company" ? "Empresa" : "Membro"}) ·{" "}
                                {new Date(entry.enteredAt).toLocaleString("pt-BR")}
                              </Typography>
                            </Box>
                            );
                          })}
                          {raffleEntries.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                              Nenhum participante até agora.
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
               );
             })}
            {raffles.length === 0 && (
              <Alert severity="info">Nenhum sorteio cadastrado ainda.</Alert>
            )}
          </Stack>
        )}
      </AdminPageContainer>
    </Layout>
  );
}
