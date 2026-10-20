import { useEffect, useState } from "react";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import type { EventSummary } from "../../lib/events";
import {
  Alert,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

interface ManagedEvent {
  id: string;
  slug?: string;
  title: string;
  startAt: string;
  status: string;
  location?: string;
}

interface Row {
  key: string;
  title: string;
  startAt: string;
  status: string;
  kind: "interno" | "externo";
}

function AdminEventsInner() {
  const { ready, isLoggedIn, isAdmin, isEventOrganizer, authFetch } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canAccess = isAdmin || isEventOrganizer;

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    if (!canAccess) return;

    const load = async () => {
      try {
        const res = await authFetch("/events?page=1&limit=50");
        if (!res.ok) throw new Error(`Falha ao carregar eventos (${res.status}).`);
        const data = (await res.json()) as
          | { events: ManagedEvent[] }
          | ManagedEvent[];
        const managed = Array.isArray(data) ? data : data.events;
        const internalRows: Row[] = managed.map((e) => ({
          key: `internal:${e.id}`,
          title: e.title,
          startAt: e.startAt,
          status: e.status,
          kind: "interno",
        }));

        const indexRes = await fetch("/events/index.json");
        const index = indexRes.ok
          ? ((await indexRes.json()) as { events: EventSummary[] })
          : { events: [] };
        const externalRows: Row[] = index.events
          .filter((e) => e.source !== "internal")
          .map((e) => ({
            key: `${e.sourceKey}:${e.id}`,
            title: e.title,
            startAt: e.startAt,
            status: e.status ?? "scheduled",
            kind: "externo" as const,
          }));

        setRows(
          [...internalRows, ...externalRows].sort((a, b) =>
            a.startAt.localeCompare(b.startAt),
          ),
        );
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    };
    load();
  }, [ready, isLoggedIn, canAccess, authFetch]);

  if (!ready || !isLoggedIn) {
    return <span className="inline-block h-10 w-64 animate-pulse rounded-md bg-sunken" />;
  }

  if (!canAccess) {
    return (
      <Alert severity="warning">
        Acesso restrito a administradores e organizadores de eventos.
      </Alert>
    );
  }

  return (
    <>
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>
      )}
      <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
        Eventos
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Visão read-only da POC 0.1 — gestão completa chega na Fase 0.4.
      </Typography>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" aria-label="Lista unificada de eventos">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Origem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rows ?? []).map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.title}</TableCell>
                <TableCell>
                  {new Date(row.startAt).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.kind}
                    color={row.kind === "interno" ? "primary" : "default"}
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows !== null && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>Nenhum evento encontrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default function AdminEventsApp() {
  return (
    <MuiIslandProvider>
      <AdminEventsInner />
    </MuiIslandProvider>
  );
}
