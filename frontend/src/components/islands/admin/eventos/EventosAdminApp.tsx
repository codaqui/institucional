/**
 * Ilha de /admin/eventos — hub do organizador: eventos próprios (CRUD
 * completo: managed events, ticket-types, staff, publish/cancel, reconcile)
 * e externos (snapshot estático com overrides, ownership e ativações) num só
 * lugar, com dialogs de pedidos e reembolso.
 *
 * Port de `src/pages/admin/eventos.tsx` (Docusaurus, 2.576 linhas) para
 * Astro — decomposto em types/hooks/subcomponentes nesta pasta:
 * - `types.ts` — tipos do contrato do backend, constantes e helpers puros;
 * - `useEventosData.ts` — carregamento (eventos, membros, snapshot externo,
 *   organizers, ativações) + force-sync do snapshot interno;
 * - `useEventosMutations.ts` — CRUD/ticket-types/staff/publish/cancel;
 * - `useEventosRows.ts` — filtros, paginação e badges da lista unificada.
 *
 * Desvios do original (adaptação Astro): `useHistory` →
 * `window.location.replace("/")`; `${apiUrl}/...` → paths no `authFetch`;
 * `Link` do Docusaurus → `<a>`; h1 fica na topbar do AppLayout (a ilha
 * começa em h2); `AdminNavbar` removido (sidebar do AppLayout cobre a nave).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import ModalConfirm from "../ui/ModalConfirm";
import EventOrdersDialog from "../events/EventOrdersDialog";
import EventReimbursementDialog from "../events/EventReimbursementDialog";
import HubAlerts from "./HubAlerts";
import HubFilters from "./HubFilters";
import ExternalEventCard from "./ExternalEventCard";
import InternalEventAccordion from "./InternalEventAccordion";
import EventFormDialog from "./EventFormDialog";
import TicketTypeDialog from "./TicketTypeDialog";
import { useAuth } from "../../../../lib/use-auth";
import { API_URL } from "../../../../lib/config";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import SyncIcon from "@mui/icons-material/Sync";
import { useAdminEventosData, useAdminEventosSnapshot } from "./useEventosData";
import { useAdminEventosMutations } from "./useEventosMutations";
import { useAdminEventosRows } from "./useEventosRows";
import {
  EMPTY_TICKET_FORM,
  type ManagedEvent,
  type MemberOption,
  type ReconcileQuotaResponse,
  type ReconcileQuotaState,
} from "./types";

function EventosAdminInner(): React.JSX.Element {
  const {
    ready,
    isLoggedIn,
    isAdmin,
    isFinanceAnalyzer,
    isEventOrganizer,
    isEventFinance,
    user,
    authFetch,
  } = useAuth();
  const apiUrl = API_URL;

  const canAccess = isAdmin || isEventOrganizer;

  const [ordersDialog, setOrdersDialog] = useState<
    | { kind: "internal"; eventId: string; title: string }
    | { kind: "external"; eventKey: string; title: string }
    | null
  >(null);

  const [reimbursementDialog, setReimbursementDialog] = useState<{
    eventId: string;
    title: string;
    communityProjectKey: string;
  } | null>(null);

  const data = useAdminEventosData(apiUrl, authFetch);

  const rowsState = useAdminEventosRows({
    events: data.events,
    externalEvents: data.externalEvents,
    externalSources: data.externalSources,
    activations: data.activations,
    organizers: data.organizers,
    user,
    isAdmin,
    internalTotal: data.internalTotal,
  });

  const { page, useBackendPagination } = rowsState;
  const {
    fetchEvents,
    fetchMembers,
    fetchExternalData,
    fetchOrganizers,
    fetchActivations,
  } = data;

  const refreshEvents = useCallback(
    () => fetchEvents(page, useBackendPagination),
    [fetchEvents, page, useBackendPagination],
  );

  const mutations = useAdminEventosMutations(authFetch, refreshEvents);

  const snapshot = useAdminEventosSnapshot(authFetch);

  const membersById = useMemo(() => {
    const map = new Map<string, MemberOption>();
    for (const m of data.members) map.set(m.id, m);
    return map;
  }, [data.members]);

  const [reconcileLoadingId, setReconcileLoadingId] = useState<string | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileQuotaState | null>(null);

  const handleReconcileQuota = useCallback(
    async (event: ManagedEvent) => {
      const confirmed = window.confirm(
        `Recalcular as vagas vendidas de "${event.title}"? Isso ajusta a quantidade vendida (quantitySold) dos tipos de ingresso.`,
      );
      if (!confirmed) return;
      setReconcileLoadingId(event.id);
      setReconcileResult(null);
      try {
        const res = await authFetch(`/events/${event.id}/reconcile-quota`, {
          method: "POST",
        });
        if (!res.ok) {
          setReconcileResult({
            eventId: event.id,
            severity: "error",
            lines: [await extractErrorMessage(res, "Erro ao recalcular vagas.")],
          });
          return;
        }
        const responseData = (await res.json()) as ReconcileQuotaResponse;
        const adjusted = responseData.results.filter((r) => r.adjusted);
        setReconcileResult({
          eventId: event.id,
          severity: "success",
          lines:
            adjusted.length === 0
              ? ["Todos os lotes já estão consistentes."]
              : adjusted.map((r) => `${r.name}: ${r.before} → ${r.after}`),
        });
        await refreshEvents();
      } catch {
        setReconcileResult({
          eventId: event.id,
          severity: "error",
          lines: ["Erro inesperado ao recalcular vagas."],
        });
      } finally {
        setReconcileLoadingId(null);
      }
    },
    [authFetch, refreshEvents],
  );

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    if (canAccess) {
      void fetchEvents(page, useBackendPagination);
      void fetchMembers();
      void fetchExternalData();
      void fetchOrganizers();
      void fetchActivations();
    }
  }, [
    ready,
    isLoggedIn,
    canAccess,
    fetchEvents,
    fetchMembers,
    fetchExternalData,
    fetchOrganizers,
    fetchActivations,
    page,
    useBackendPagination,
  ]);

  const canReimburse = isAdmin || isFinanceAnalyzer || isEventFinance;

  if (!ready || !isLoggedIn) {
    return (
      <PageContainer sx={{ textAlign: "center" }}>
        <CircularProgress />
      </PageContainer>
    );
  }

  if (!canAccess) {
    return (
      <PageContainer>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }} gutterBottom>
          Eventos
        </Typography>
        <Alert severity="warning">
          Acesso restrito a administradores e organizadores de eventos.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
            Eventos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hub do organizador: eventos próprios e externos num só lugar.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={
              snapshot.snapshotLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SyncIcon />
              )
            }
            disabled={snapshot.snapshotLoading}
            onClick={snapshot.handleSnapshot}
          >
            Sincronizar snapshot agora
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={mutations.openCreateDialog}>
            Novo evento
          </Button>
        </Stack>
      </Box>

      {data.loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {data.loadError}
        </Alert>
      )}
      {mutations.actionError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {mutations.actionError}
        </Alert>
      )}
      {data.externalError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {data.externalError}
        </Alert>
      )}
      <HubAlerts
        snapshotResult={snapshot.snapshotResult}
        snapshotError={snapshot.snapshotError}
        publishSuccess={mutations.publishSuccess}
        saveSuccess={mutations.saveSuccess}
        onCloseSnapshotError={() => snapshot.setSnapshotError("")}
        onCloseSnapshotResult={() => snapshot.setSnapshotResult(null)}
        onClosePublishSuccess={() => mutations.setPublishSuccess(null)}
        onCloseSaveSuccess={() => mutations.setSaveSuccess(null)}
      />

      {data.loading || data.externalLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* ── Busca e filtros da lista unificada ── */}
          <HubFilters
            search={rowsState.search}
            showInternos={rowsState.showInternos}
            showExternos={rowsState.showExternos}
            onlyOverride={rowsState.onlyOverride}
            onlyEditable={rowsState.onlyEditable}
            onlyFeatures={rowsState.onlyFeatures}
            communityFilter={rowsState.communityFilter}
            onSearchChange={rowsState.setSearch}
            onToggleInternos={() => rowsState.setShowInternos((v) => !v)}
            onToggleExternos={() => rowsState.setShowExternos((v) => !v)}
            onToggleOverride={() => rowsState.setOnlyOverride((v) => !v)}
            onToggleEditable={() => rowsState.setOnlyEditable((v) => !v)}
            onToggleFeatures={() => rowsState.setOnlyFeatures((v) => !v)}
            onCommunityChange={rowsState.setCommunityFilter}
          />

          <Typography
            variant="h6"
            component="h3"
            sx={{ fontWeight: 700, mb: 1.5 }}
          >
            Todos os eventos ({rowsState.filteredRows.length})
          </Typography>

          {rowsState.pageRows.length === 0 ? (
            <Alert severity="info">
              {rowsState.rows.length === 0
                ? "Nenhum evento cadastrado ainda. Crie o primeiro com o botão acima."
                : "Nenhum evento encontrado com os filtros atuais."}
            </Alert>
          ) : (
            rowsState.pageRows.map((row) =>
              row.kind === "external" ? (
                <ExternalEventCard
                  key={row.key}
                  row={row}
                  sourceLabel={rowsState.sourceLabel}
                  onOrdersClick={(eventKey, title) =>
                    setOrdersDialog({ kind: "external", eventKey, title })
                  }
                />
              ) : (
                <InternalEventAccordion
                  key={row.key}
                  row={row}
                  members={data.members}
                  membersById={membersById}
                  staffForm={mutations.staffForm}
                  canReimburse={canReimburse}
                  onEdit={mutations.openEditDialog}
                  onPublish={(event) => {
                    mutations.setPublishTarget(event);
                    mutations.setPublishError("");
                  }}
                  onCancel={(event) => {
                    mutations.setCancelTarget(event);
                    mutations.setCancelError("");
                  }}
                  onOrdersClick={(eventId, title) =>
                    setOrdersDialog({ kind: "internal", eventId, title })
                  }
                  onReimbursementClick={(event) =>
                    setReimbursementDialog({
                      eventId: event.id,
                      title: event.title,
                      communityProjectKey: event.communityProjectKey,
                    })
                  }
                  onAddTicketClick={(event) => {
                    mutations.setTicketForm(EMPTY_TICKET_FORM);
                    mutations.setTicketError("");
                    mutations.setTicketDialog({ event, mode: "create" });
                  }}
                  onEditTicket={mutations.openEditTicketDialog}
                  onDeactivateTicket={mutations.handleDeactivateTicketType}
                  onAddStaff={mutations.handleAddStaff}
                  onRemoveStaff={mutations.handleRemoveStaff}
                  onReconcileQuota={handleReconcileQuota}
                  reconcileLoadingId={reconcileLoadingId}
                  reconcileResult={reconcileResult}
                  onDismissReconcileResult={() => setReconcileResult(null)}
                  publishingId={mutations.publishingId}
                  staffAddingId={mutations.staffAddingId}
                  staffRemovingId={mutations.staffRemovingId}
                  onStaffMemberChange={(eventId, memberId) =>
                    mutations.setStaffForm((prev) => ({
                      ...prev,
                      [eventId]: {
                        memberId,
                        staffRole: prev[eventId]?.staffRole ?? "checker",
                      },
                    }))
                  }
                  onStaffRoleChange={(eventId, staffRole) =>
                    mutations.setStaffForm((prev) => ({
                      ...prev,
                      [eventId]: {
                        memberId: prev[eventId]?.memberId ?? "",
                        staffRole,
                      },
                    }))
                  }
                />
              ),
            )
          )}

          {rowsState.pageCount > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={rowsState.pageCount}
                page={rowsState.currentPage}
                onChange={(_, p) => rowsState.setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* ── Dialog: Criar / Editar evento ── */}
      <EventFormDialog
        eventDialog={mutations.eventDialog}
        onClose={() => mutations.setEventDialog(null)}
        eventForm={mutations.eventForm}
        setEventForm={mutations.setEventForm}
        eventSaving={mutations.eventSaving}
        eventError={mutations.eventError}
        onSave={mutations.handleSaveEvent}
      />

      {/* ── Modal: Cancelar evento ── */}
      <ModalConfirm
        open={!!mutations.cancelTarget}
        onClose={() => mutations.setCancelTarget(null)}
        title={`Cancelar "${mutations.cancelTarget?.title}"?`}
        description="O evento será marcado como cancelado e deixará de aceitar inscrições. Esta ação é registrada em auditoria."
        variant="error"
        confirmLabel="Cancelar evento"
        loading={mutations.cancelLoading}
        error={mutations.cancelError}
        onConfirm={mutations.handleCancelEvent}
      />

      {/* ── Modal: Publicar evento ── */}
      <ModalConfirm
        open={!!mutations.publishTarget}
        onClose={() => mutations.setPublishTarget(null)}
        title="Publicar evento?"
        description={`O evento "${mutations.publishTarget?.title ?? ""}" ficará visível publicamente no site e no checkout de inscrições.`}
        variant="success"
        confirmLabel="Publicar"
        loading={mutations.publishingId === mutations.publishTarget?.id}
        error={mutations.publishError}
        onConfirm={() => {
          if (mutations.publishTarget) void mutations.handlePublish(mutations.publishTarget);
        }}
      />

      {/* ── Dialog: Criar / Editar tipo de ingresso ── */}
      <TicketTypeDialog
        ticketDialog={mutations.ticketDialog}
        onClose={() => mutations.setTicketDialog(null)}
        ticketForm={mutations.ticketForm}
        setTicketForm={mutations.setTicketForm}
        ticketSaving={mutations.ticketSaving}
        ticketError={mutations.ticketError}
        onSave={mutations.handleCreateTicketType}
      />

      <EventOrdersDialog
        open={!!ordersDialog}
        onClose={() => setOrdersDialog(null)}
        eventId={ordersDialog?.kind === "internal" ? ordersDialog.eventId : undefined}
        eventKey={ordersDialog?.kind === "external" ? ordersDialog.eventKey : undefined}
        eventTitle={ordersDialog?.title ?? ""}
        apiUrl={apiUrl}
        authFetch={authFetch}
      />

      <EventReimbursementDialog
        open={!!reimbursementDialog}
        onClose={() => setReimbursementDialog(null)}
        apiUrl={apiUrl}
        authFetch={authFetch}
        title={reimbursementDialog?.title ?? ""}
        eventId={reimbursementDialog?.eventId}
        communityProjectKey={reimbursementDialog?.communityProjectKey}
      />
    </PageContainer>
  );
}

export default function EventosAdminApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <EventosAdminInner />
    </MuiIslandProvider>
  );
}
