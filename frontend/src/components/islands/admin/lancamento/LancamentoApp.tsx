/**
 * Ilha de /admin/lancamento — lançamento direto de dupla partida +
 * solicitações de transferência entre contas.
 * Port de `src/pages/admin/lancamento.tsx` (Docusaurus) para Astro:
 * `useHistory` → `window.location.replace`, `${apiUrl}` → paths no `authFetch`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import PostAddIcon from "@mui/icons-material/PostAdd";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import TabPanel from "../ui/TabPanel";
import DirectExpenseForm from "./DirectExpenseForm";
import TransfersPanel from "./TransfersPanel";
import { useAuth } from "../../../../lib/use-auth";
import { parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import type { Account, TransferRequest } from "./types";

function LancamentoInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, isFinanceAnalyzer, authFetch } = useAuth();

  const canAccess = isAdmin || isFinanceAnalyzer;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  const pendingTransfers = useMemo(
    () => transfers.filter((transfer) => transfer.status === "pending"),
    [transfers],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountsRes, transfersRes] = await Promise.all([
        authFetch("/ledger/accounts"),
        authFetch("/account-transfers"),
      ]);

      const accountsData = await parseAuthJson<Account[]>(accountsRes, setError);
      const transfersData = await parseAuthJson<{ data?: TransferRequest[] }>(
        transfersRes,
        setError,
      );

      if (accountsData) {
        setAccounts(accountsData);
      }
      const nextTransfers = Array.isArray(transfersData?.data)
        ? transfersData.data
        : [];
      setTransfers(nextTransfers);
    } catch {
      setError("Não foi possível carregar os dados de lançamento.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
      return;
    }
    void fetchData();
  }, [ready, isLoggedIn, canAccess, fetchData]);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "transferencias") {
      setTab(1);
    }
  }, []);

  if (!ready || !isLoggedIn || !canAccess) {
    return null;
  }

  return (
    <PageContainer>
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}
        >
          <PostAddIcon color="primary" fontSize="large" />
          Lançamento e Transferências
        </Typography>
        <Typography color="text.secondary">
          Registre lançamentos de dupla partida, crie contas externas e
          acompanhe solicitações de transferência.
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            sx={{ mb: 2 }}
          >
            <Tab label="Lançamento direto" />
            <Tab
              label={`Transferências (${pendingTransfers.length} pendente${
                pendingTransfers.length === 1 ? "" : "s"
              })`}
            />
          </Tabs>

          <TabPanel index={0} value={tab}>
            <DirectExpenseForm accounts={accounts} onChanged={fetchData} />
          </TabPanel>
          <TabPanel index={1} value={tab}>
            <TransfersPanel
              accounts={accounts}
              transfers={transfers}
              onChanged={fetchData}
            />
          </TabPanel>
        </>
      )}
    </PageContainer>
  );
}

export default function LancamentoApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <LancamentoInner />
    </MuiIslandProvider>
  );
}
