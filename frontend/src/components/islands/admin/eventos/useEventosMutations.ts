/**
 * Hook de mutações do hub de eventos — CRUD de eventos, ticket-types, staff,
 * publish/cancel. Port de `src/pages/admin/eventos.tsx` (Docusaurus).
 */

import { useCallback, useState } from "react";
import { toDateTimeLocal } from "../../../../lib/datetime";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import {
  buildEventPayload,
  buildTicketPayload,
  EMPTY_EVENT_FORM,
  EMPTY_TICKET_FORM,
  type EventDialogState,
  type EventForm,
  type EventStaff,
  type EventStaffRole,
  type ManagedEvent,
  type TicketDialogState,
  type TicketForm,
  type TicketType,
} from "./types";

export interface UseAdminEventosMutationsReturn {
  eventDialog: EventDialogState;
  setEventDialog: React.Dispatch<React.SetStateAction<EventDialogState>>;
  eventForm: EventForm;
  setEventForm: React.Dispatch<React.SetStateAction<EventForm>>;
  eventSaving: boolean;
  eventError: string;
  cancelTarget: ManagedEvent | null;
  setCancelTarget: React.Dispatch<React.SetStateAction<ManagedEvent | null>>;
  cancelLoading: boolean;
  cancelError: string;
  ticketDialog: TicketDialogState;
  setTicketDialog: React.Dispatch<React.SetStateAction<TicketDialogState>>;
  ticketForm: TicketForm;
  setTicketForm: React.Dispatch<React.SetStateAction<TicketForm>>;
  ticketSaving: boolean;
  ticketError: string;
  staffForm: Record<string, { memberId: string; staffRole: EventStaffRole }>;
  setStaffForm: React.Dispatch<
    React.SetStateAction<Record<string, { memberId: string; staffRole: EventStaffRole }>>
  >;
  publishingId: string | null;
  publishTarget: ManagedEvent | null;
  setPublishTarget: React.Dispatch<React.SetStateAction<ManagedEvent | null>>;
  publishError: string;
  setPublishError: React.Dispatch<React.SetStateAction<string>>;
  staffAddingId: string | null;
  staffRemovingId: string | null;
  actionError: string;
  setActionError: React.Dispatch<React.SetStateAction<string>>;
  publishSuccess: ManagedEvent | null;
  setPublishSuccess: React.Dispatch<React.SetStateAction<ManagedEvent | null>>;
  saveSuccess: { event: ManagedEvent; mode: "create" | "edit" } | null;
  setSaveSuccess: React.Dispatch<
    React.SetStateAction<{ event: ManagedEvent; mode: "create" | "edit" } | null>
  >;
  openCreateDialog: () => void;
  openEditDialog: (event: ManagedEvent) => void;
  handleSaveEvent: () => Promise<void>;
  handlePublish: (event: ManagedEvent) => Promise<void>;
  handleCancelEvent: () => Promise<void>;
  handleCreateTicketType: () => Promise<void>;
  openEditTicketDialog: (event: ManagedEvent, ticket: TicketType) => void;
  handleDeactivateTicketType: (ticket: TicketType) => Promise<void>;
  handleAddStaff: (event: ManagedEvent) => Promise<void>;
  handleRemoveStaff: (event: ManagedEvent, staff: EventStaff) => Promise<void>;
  setCancelError: React.Dispatch<React.SetStateAction<string>>;
  setTicketError: React.Dispatch<React.SetStateAction<string>>;
}

export function useAdminEventosMutations(
  authFetch: (path: string, init?: RequestInit) => Promise<Response>,
  fetchEvents: () => Promise<void>,
): UseAdminEventosMutationsReturn {
  const [eventDialog, setEventDialog] = useState<EventDialogState>(null);
  const [eventForm, setEventForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState("");

  const [cancelTarget, setCancelTarget] = useState<ManagedEvent | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [ticketDialog, setTicketDialog] = useState<TicketDialogState>(null);
  const [ticketForm, setTicketForm] = useState<TicketForm>(EMPTY_TICKET_FORM);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [ticketError, setTicketError] = useState("");

  const [staffForm, setStaffForm] = useState<
    Record<string, { memberId: string; staffRole: EventStaffRole }>
  >({});

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<ManagedEvent | null>(null);
  const [publishError, setPublishError] = useState("");
  const [staffAddingId, setStaffAddingId] = useState<string | null>(null);
  const [staffRemovingId, setStaffRemovingId] = useState<string | null>(null);

  const [actionError, setActionError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState<ManagedEvent | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<{
    event: ManagedEvent;
    mode: "create" | "edit";
  } | null>(null);

  const openCreateDialog = useCallback(() => {
    setEventForm(EMPTY_EVENT_FORM);
    setEventError("");
    setEventDialog({ mode: "create" });
  }, []);

  const openEditDialog = useCallback((event: ManagedEvent) => {
    setEventForm({
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      description: event.description ?? "",
      imageUrl: event.imageUrl ?? "",
      location: event.location,
      startAt: toDateTimeLocal(event.startAt),
      endAt: toDateTimeLocal(event.endAt),
      timezone: event.timezone || "America/Sao_Paulo",
      communityProjectKey: event.communityProjectKey,
      capacity: event.capacity != null ? String(event.capacity) : "",
      workloadMinutes: event.workloadMinutes != null ? String(event.workloadMinutes) : "",
    });
    setEventError("");
    setEventDialog({ mode: "edit", event });
  }, []);

  const handleSaveEvent = useCallback(async () => {
    if (!eventDialog) return;
    setEventError("");
    const validation = buildEventPayload(eventForm, eventDialog.mode);
    if (validation.error || !validation.payload) {
      setEventError(validation.error ?? "Erro de validação.");
      return;
    }
    setEventSaving(true);
    try {
      const isEdit = eventDialog.mode === "edit";
      const res = await authFetch(
        isEdit ? `/events/${eventDialog.event.id}` : `/events`,
        { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(validation.payload) },
      );
      if (!res.ok) {
        setEventError(await extractErrorMessage(res, "Erro ao salvar evento."));
        return;
      }
      const saved = (await res.json()) as ManagedEvent;
      setEventDialog(null);
      setSaveSuccess({ event: saved, mode: isEdit ? "edit" : "create" });
      await fetchEvents();
    } catch {
      setEventError("Erro inesperado.");
    } finally {
      setEventSaving(false);
    }
  }, [authFetch, eventDialog, eventForm, fetchEvents]);

  const handlePublish = useCallback(
    async (event: ManagedEvent) => {
      if (publishingId) return;
      setPublishingId(event.id);
      setPublishError("");
      setPublishSuccess(null);
      try {
        const res = await authFetch(`/events/${event.id}/publish`, { method: "POST" });
        if (!res.ok) {
          setPublishError(await extractErrorMessage(res, "Erro ao publicar evento."));
          return;
        }
        setPublishTarget(null);
        setPublishSuccess(event);
        await fetchEvents();
      } catch {
        setPublishError("Erro inesperado ao publicar.");
      } finally {
        setPublishingId(null);
      }
    },
    [authFetch, fetchEvents, publishingId],
  );

  const handleCancelEvent = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setCancelError("");
    try {
      const res = await authFetch(`/events/${cancelTarget.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        setCancelError(await extractErrorMessage(res, "Erro ao cancelar evento."));
        return;
      }
      setCancelTarget(null);
      await fetchEvents();
    } catch {
      setCancelError("Erro inesperado.");
    } finally {
      setCancelLoading(false);
    }
  }, [authFetch, cancelTarget, fetchEvents]);

  const handleCreateTicketType = useCallback(async () => {
    if (!ticketDialog) return;
    setTicketError("");
    const validation = buildTicketPayload(ticketForm, ticketDialog.mode);
    if (validation.error || !validation.payload) {
      setTicketError(validation.error ?? "Erro de validação.");
      return;
    }
    setTicketSaving(true);
    try {
      const isEdit = ticketDialog.mode === "edit";
      const res = await authFetch(
        isEdit
          ? `/events/ticket-types/${ticketDialog.ticket.id}`
          : `/events/${ticketDialog.event.id}/ticket-types`,
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify(validation.payload),
        },
      );
      if (!res.ok) {
        setTicketError(
          await extractErrorMessage(res, "Erro ao salvar tipo de ingresso."),
        );
        return;
      }
      setTicketDialog(null);
      await fetchEvents();
    } catch {
      setTicketError("Erro inesperado.");
    } finally {
      setTicketSaving(false);
    }
  }, [authFetch, ticketDialog, ticketForm, fetchEvents]);

  const openEditTicketDialog = useCallback((event: ManagedEvent, ticket: TicketType) => {
    setTicketForm({
      name: ticket.name,
      kind: ticket.kind,
      price: (ticket.priceCents / 100).toFixed(2),
      quantityTotal: String(ticket.quantityTotal),
      salesStartAt: toDateTimeLocal(ticket.salesStartAt),
      salesEndAt: toDateTimeLocal(ticket.salesEndAt),
      maxPerOrder: String(ticket.maxPerOrder),
    });
    setTicketError("");
    setTicketDialog({ event, mode: "edit", ticket });
  }, []);

  const handleDeactivateTicketType = useCallback(
    async (ticket: TicketType) => {
      setActionError("");
      try {
        const res = await authFetch(`/events/ticket-types/${ticket.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        });
        if (!res.ok) {
          setActionError(
            await extractErrorMessage(res, "Erro ao desativar tipo de ingresso."),
          );
          return;
        }
        await fetchEvents();
      } catch {
        setActionError("Erro inesperado ao desativar tipo de ingresso.");
      }
    },
    [authFetch, fetchEvents],
  );

  const handleAddStaff = useCallback(
    async (event: ManagedEvent) => {
      const form = staffForm[event.id];
      if (!form?.memberId || staffAddingId) return;
      setStaffAddingId(event.id);
      setActionError("");
      try {
        const res = await authFetch(`/events/${event.id}/staff`, {
          method: "POST",
          body: JSON.stringify({ memberId: form.memberId, staffRole: form.staffRole }),
        });
        if (!res.ok) {
          setActionError(await extractErrorMessage(res, "Erro ao adicionar staff."));
          return;
        }
        setStaffForm((prev) => ({
          ...prev,
          [event.id]: { memberId: "", staffRole: "checker" },
        }));
        await fetchEvents();
      } catch {
        setActionError("Erro inesperado ao adicionar staff.");
      } finally {
        setStaffAddingId(null);
      }
    },
    [authFetch, staffForm, fetchEvents, staffAddingId],
  );

  const handleRemoveStaff = useCallback(
    async (event: ManagedEvent, staff: EventStaff) => {
      if (staffRemovingId) return;
      setStaffRemovingId(staff.id);
      setActionError("");
      try {
        const res = await authFetch(`/events/${event.id}/staff/${staff.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setActionError(await extractErrorMessage(res, "Erro ao remover staff."));
          return;
        }
        await fetchEvents();
      } catch {
        setActionError("Erro inesperado ao remover staff.");
      } finally {
        setStaffRemovingId(null);
      }
    },
    [authFetch, fetchEvents, staffRemovingId],
  );

  return {
    eventDialog,
    setEventDialog,
    eventForm,
    setEventForm,
    eventSaving,
    eventError,
    cancelTarget,
    setCancelTarget,
    cancelLoading,
    cancelError,
    ticketDialog,
    setTicketDialog,
    ticketForm,
    setTicketForm,
    ticketSaving,
    ticketError,
    staffForm,
    setStaffForm,
    publishingId,
    staffAddingId,
    staffRemovingId,
    publishTarget,
    setPublishTarget,
    publishError,
    setPublishError,
    actionError,
    setActionError,
    publishSuccess,
    setPublishSuccess,
    saveSuccess,
    setSaveSuccess,
    openCreateDialog,
    openEditDialog,
    handleSaveEvent,
    handlePublish,
    handleCancelEvent,
    handleCreateTicketType,
    openEditTicketDialog,
    handleDeactivateTicketType,
    handleAddStaff,
    handleRemoveStaff,
    setCancelError,
    setTicketError,
  };
}
