import React, { useEffect, useState, useCallback } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import { useAuth } from "../../hooks/useAuth";
import ModalConfirm from "../../components/ModalConfirm";
import VendorTransactionCard from "../../components/VendorTransactionCard";
import VendorTransactionForm, {
  VendorTxFormValues,
} from "../../components/VendorTransactionForm";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Vendor {
  id: string;
  name: string;
  document: string | null;
  website: string | null;
  accountId: string;
}

interface VendorReceipt {
  id: string;
  vendorId: string;
  destinationAccountId: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  internalReceiptUrl: string | null;
  registeredByUserId: string;
  occurredAt: string;
  createdAt: string;
  vendor?: Vendor;
  destinationAccount?: Account;
  registeredBy?: { name: string; avatarUrl: string; githubHandle: string };
}

export default function RecebimentosPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [tab, setTab] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [receipts, setReceipts] = useState<VendorReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reuseSeed, setReuseSeed] = useState<VendorTxFormValues | undefined>();
  const [reuseKey, setReuseKey] = useState(0);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, aRes, rRes] = await Promise.all([
        authFetch(`${apiUrl}/vendors`),
        authFetch(`${apiUrl}/ledger/accounts`),
        authFetch(`${apiUrl}/vendors/receipts`),
      ]);
      const unauthorized = [vRes, aRes, rRes].find((r) => r.status === 401);
      if (unauthorized) {
        setError("Sessão expirada — faça login novamente.");
        return;
      }
      const failed = [vRes, aRes, rRes].find((r) => !r.ok);
      if (failed) throw new Error(`HTTP ${failed.status}`);
      const [vData, aData, rData] = await Promise.all([vRes.json(), aRes.json(), rRes.json()]);
      setVendors(Array.isArray(vData) ? vData : []);
      setAccounts(Array.isArray(aData) ? aData : []);
      setReceipts(Array.isArray(rData) ? rData : []);
      setError("");
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.replace("/");
      return;
    }
    fetchAll();
  }, [ready, isLoggedIn, isAdmin, history, fetchAll]);

  const reuseReceipt = (r: VendorReceipt) => {
    setReuseSeed({
      vendorId: r.vendorId,
      accountId: r.destinationAccountId,
      amount: (r.amount / 100).toFixed(2),
      description: r.description,
      receiptUrl: r.receiptUrl ?? "",
      internalReceiptUrl: r.internalReceiptUrl ?? "",
    });
    setReuseKey((k) => k + 1);
    setTab(0);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await authFetch(`${apiUrl}/vendors/receipts/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteId(null);
      fetchAll();
    } catch {
      setError("Não foi possível excluir o recebimento.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!ready || loading) {
    return (
      <Layout title="Recebimentos">
        <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
          <CircularProgress />
        </Container>
      </Layout>
    );
  }

  return (
    <Layout
      title="Recebimentos de Fornecedores"
      description="Registrar recebimentos vindos de fornecedores ou parceiros"
    >
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          <CallReceivedIcon sx={{ mr: 1, verticalAlign: "middle", color: "success.main" }} />
          Recebimentos de Fornecedores
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Registre repasses vindos de fornecedores/parceiros (ex: Sympla, plataformas de eventos,
          parcerias).
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Novo Recebimento" />
          <Tab label={`Histórico (${receipts.length})`} />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {tab === 0 && (
          <Card variant="outlined">
            <CardContent>
              <VendorTransactionForm
                direction="receipt"
                vendors={vendors}
                accounts={accounts}
                authFetch={authFetch}
                apiUrl={apiUrl}
                onSuccess={fetchAll}
                initialValues={reuseSeed}
                initialKey={reuseKey}
              />
            </CardContent>
          </Card>
        )}

        {tab === 1 && (
          <Box>
            {receipts.length === 0 ? (
              <Alert severity="info">Nenhum recebimento registrado.</Alert>
            ) : (
              receipts.map((r) => (
                <VendorTransactionCard
                  key={r.id}
                  tx={r}
                  direction="receipt"
                  accountLabel={r.destinationAccount?.name ?? r.destinationAccountId}
                  onReuse={() => reuseReceipt(r)}
                  onDelete={() => setDeleteId(r.id)}
                />
              ))
            )}
          </Box>
        )}
      </Container>

      <ModalConfirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir recebimento?"
        description="Será criado um lançamento reverso (estorno) no ledger e o registro será removido."
        variant="error"
        confirmLabel="Excluir"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
      />
    </Layout>
  );
}
