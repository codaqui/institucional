import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MuiIslandProvider from "../MuiIslandProvider";
import PageContainer from "../admin/ui/PageContainer";
import PaginationControls from "../ui/PaginationControls";
import MenteeLinkDialog from "./MenteeLinkDialog";
import SessionParticipant from "./SessionParticipant";
import {
  formatMentorshipDate,
  MENTORSHIP_STATUS_LABEL,
  type MentorshipSessionView,
} from "../../../lib/mentorship";
import { useAuth } from "../../../lib/use-auth";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE } from "../../../lib/pagination";

interface MentorProfile {
  id: string;
  areas: string[];
  focus: string | null;
}
type MentorSession = MentorshipSessionView;

interface AvailabilityRule {
  weekday: number;
  startTime: string;
  endTime: string;
  timeZone: string;
}

interface WindowDraft {
  startTime: string;
  endTime: string;
}

interface DayDraft {
  windows: WindowDraft[];
  timeZone: string;
}

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_WINDOW = { startTime: "19:00", endTime: "20:00" };
const DEFAULT_TIME_ZONE =
  (typeof Intl !== "undefined" &&
    Intl.DateTimeFormat().resolvedOptions().timeZone) ||
  "America/Sao_Paulo";
const TIMEZONE_OPTIONS: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/Sao_Paulo"];

function sortWindows<T extends { startTime: string; endTime: string }>(
  windows: T[],
): T[] {
  return [...windows].sort((a, b) =>
    `${a.startTime}${a.endTime}`.localeCompare(`${b.startTime}${b.endTime}`),
  );
}

function isDayDirty(
  weekday: number,
  draft: DayDraft,
  availability: AvailabilityRule[],
): boolean {
  const canonical = sortWindows(
    availability
      .filter((rule) => rule.weekday === weekday)
      .map(({ startTime, endTime, timeZone }) => ({
        startTime,
        endTime,
        timeZone,
      })),
  );
  if (canonical.length === 0 && draft.windows.length === 0) return false;
  const draftRules = sortWindows(draft.windows).map((windowDraft) => ({
    startTime: windowDraft.startTime,
    endTime: windowDraft.endTime,
    timeZone: draft.timeZone,
  }));
  return JSON.stringify(canonical) !== JSON.stringify(draftRules);
}

function validateDay(draft: DayDraft): string[] {
  const problems: string[] = [];
  if (!draft.timeZone) problems.push("Escolha o fuso horário do dia.");
  const validWindows: WindowDraft[] = [];
  draft.windows.forEach((windowDraft, index) => {
    const label = `Janela ${index + 1}`;
    if (
      !TIME_PATTERN.test(windowDraft.startTime) ||
      !TIME_PATTERN.test(windowDraft.endTime)
    ) {
      problems.push(`${label}: informe início e fim no formato HH:mm.`);
      return;
    }
    if (windowDraft.startTime >= windowDraft.endTime) {
      problems.push(`${label}: o início deve ser anterior ao fim.`);
      return;
    }
    validWindows.push(windowDraft);
  });
  const ordered = sortWindows(validWindows);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startTime < ordered[index - 1].endTime) {
      problems.push("As janelas não podem se sobrepor.");
      break;
    }
  }
  return problems;
}

function MentorDashboard() {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [areas, setAreas] = useState("");
  const [focus, setFocus] = useState("");
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [weekday, setWeekday] = useState(1);
  const [drafts, setDrafts] = useState<Record<number, DayDraft>>({});
  const [availabilityError, setAvailabilityError] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkingSession, setLinkingSession] = useState<MentorSession | null>(
    null,
  );
  const availabilityErrorRef = useRef<HTMLDivElement | null>(null);
  const availabilityLoadErrorRef = useRef<HTMLDivElement | null>(null);

  const buildDayDraft = useCallback(
    (day: number): DayDraft => ({
      windows: availability
        .filter((rule) => rule.weekday === day)
        .map((rule) => ({
          startTime: rule.startTime,
          endTime: rule.endTime,
        })),
      timeZone:
        availability.find((rule) => rule.weekday === day)?.timeZone ??
        DEFAULT_TIME_ZONE,
    }),
    [availability],
  );

  const dayDraft = useMemo(
    () => drafts[weekday] ?? buildDayDraft(weekday),
    [drafts, weekday, buildDayDraft],
  );

  const updateDayDraft = (update: (draft: DayDraft) => DayDraft) => {
    setDrafts((current) => ({
      ...current,
      [weekday]: update(current[weekday] ?? dayDraft),
    }));
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const [profileResponse, sessionsResponse, availabilityResponse] =
        await Promise.all([
          authFetch("/mentorship/profile"),
          authFetch("/mentorship/sessions"),
          authFetch("/mentorship/availability/mine"),
        ]);
      const profileResult = await parseAuthJson<MentorProfile>(
        profileResponse,
        setError,
      );
      const sessionResult = await parseAuthJson<MentorSession[]>(
        sessionsResponse,
        setError,
      );
      const availabilityResult = await parseAuthJson<AvailabilityRule[]>(
        availabilityResponse,
        () => {},
      );
      if (profileResult) {
        setProfile(profileResult);
        setAreas(profileResult.areas.join(", "));
        setFocus(profileResult.focus ?? "");
      }
      if (sessionResult) setSessions(sessionResult);
      if (!availabilityResult || !Array.isArray(availabilityResult)) {
        setAvailabilityStatus("error");
        return null;
      }
      const nextAvailability = availabilityResult;
      setAvailability(nextAvailability);
      setAvailabilityStatus("ready");
      return nextAvailability;
    } catch {
      setError("Não foi possível carregar o painel de mentoria.");
      setAvailabilityStatus("error");
      return null;
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    void load();
  }, [ready, isLoggedIn, load]);

  const mutate = async (
    path: string,
    body: object | undefined,
    message: string,
    method = "POST",
  ) => {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const response = await authFetch(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        setError(
          await extractErrorMessage(
            response,
            "Não foi possível atualizar a mentoria.",
          ),
        );
        return false;
      }
      setFeedback(message);
      await load();
      return true;
    } catch {
      setError("Não foi possível atualizar a mentoria.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveAvailability = async (day: number, rules: AvailabilityRule[]) => {
    setBusy(true);
    setError("");
    setFeedback("");
    setAvailabilityError("");
    try {
      const response = await authFetch(`/mentorship/availability/${day}`, {
        method: "PUT",
        body: JSON.stringify(rules),
      });
      if (!response.ok) {
        setAvailabilityError(
          await extractErrorMessage(
            response,
            "Não foi possível salvar a disponibilidade.",
          ),
        );
        return;
      }
      setFeedback(`Disponibilidade de ${WEEKDAYS[day]} salva.`);
      const canonical = await load();
      if (canonical) {
        setDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([draftDay, draft]) =>
              isDayDirty(Number(draftDay), draft, canonical),
            ),
          ),
        );
      }
    } catch {
      setAvailabilityError("Não foi possível salvar a disponibilidade.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (availabilityError) availabilityErrorRef.current?.focus();
  }, [availabilityError]);

  useEffect(() => {
    if (availabilityStatus === "error")
      availabilityLoadErrorRef.current?.focus();
  }, [availabilityStatus]);

  const handleAvailabilitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    setAvailabilityError("");
    const problems = validateDay(dayDraft);
    if (problems.length > 0) {
      setAvailabilityError(problems.join(" "));
      return;
    }
    setAvailabilityError("");
    void saveAvailability(
      weekday,
      dayDraft.windows.map((windowDraft) => ({
        weekday,
        startTime: windowDraft.startTime,
        endTime: windowDraft.endTime,
        timeZone: dayDraft.timeZone,
      })),
    );
  };

  if (!ready || !profile) {
    return (
      <PageContainer>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Typography>Carregando mentoria…</Typography>
        )}
      </PageContainer>
    );
  }

  const totalPages = Math.ceil(sessions.length / DEFAULT_PAGE_SIZE);
  const visibleSessions = sessions.slice(
    (page - 1) * DEFAULT_PAGE_SIZE,
    page * DEFAULT_PAGE_SIZE,
  );
  const dirtyDays = Object.keys(drafts)
    .map(Number)
    .filter((day) => isDayDirty(day, drafts[day], availability));

  return (
    <PageContainer>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
            Minha mentoria
          </Typography>
          <Typography color="text.secondary">
            Perfil, disponibilidade e sessões dos participantes.
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {feedback && <Alert severity="success">{feedback}</Alert>}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" component="h3">
                Perfil público
              </Typography>
              <TextField
                label="Áreas"
                value={areas}
                onChange={(event) => setAreas(event.target.value)}
              />
              <TextField
                label="Foco"
                multiline
                minRows={2}
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
              />
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    "/mentorship/profile",
                    {
                      areas: areas
                        .split(",")
                        .map((area) => area.trim())
                        .filter(Boolean),
                      focus,
                    },
                    "Perfil atualizado.",
                    "PATCH",
                  )
                }
              >
                Salvar perfil
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" component="h3">
                Disponibilidade semanal
              </Typography>
              {dirtyDays.length > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ flexWrap: "wrap" }}
                >
                  {dirtyDays.map((day) => (
                    <Chip
                      key={day}
                      size="small"
                      color="warning"
                      label={`${WEEKDAYS[day]} (não salvo)`}
                    />
                  ))}
                </Stack>
              )}
              <Box
                component="form"
                noValidate
                aria-label="Editor de disponibilidade semanal"
                onSubmit={handleAvailabilitySubmit}
              >
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Dia da semana"
                    value={weekday}
                    onChange={(event) => setWeekday(Number(event.target.value))}
                    slotProps={{ select: { native: true } }}
                  >
                    {WEEKDAYS.map((label, value) => (
                      <option key={label} value={value}>
                        {label}
                      </option>
                    ))}
                  </TextField>

                  {availabilityStatus === "loading" && (
                    <Typography color="text.secondary">
                      Carregando disponibilidade…
                    </Typography>
                  )}
                  {availabilityStatus === "error" && (
                    <>
                      <Alert
                        severity="error"
                        tabIndex={-1}
                        ref={availabilityLoadErrorRef}
                      >
                        Não foi possível carregar sua disponibilidade. Tente
                        novamente.
                      </Alert>
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => void load()}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Tentar novamente
                      </Button>
                    </>
                  )}
                  {availabilityStatus === "ready" && (
                    <>
                      {dayDraft.windows.length === 0 ? (
                        <Typography color="text.secondary">
                          Nenhuma janela cadastrada para {WEEKDAYS[weekday]}.
                          Adicione uma janela para atender neste dia.
                        </Typography>
                      ) : (
                        dayDraft.windows.map((windowDraft, index) => (
                          <Stack
                            key={`janela-${index}`}
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            sx={{ alignItems: { sm: "center" } }}
                          >
                            <TextField
                              fullWidth
                              label={`Início da janela ${index + 1}`}
                              type="time"
                              value={windowDraft.startTime}
                              onChange={(event) =>
                                updateDayDraft((draft) => ({
                                  ...draft,
                                  windows: draft.windows.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            startTime: event.target.value,
                                          }
                                        : item,
                                  ),
                                }))
                              }
                              slotProps={{ inputLabel: { shrink: true } }}
                            />
                            <TextField
                              fullWidth
                              label={`Fim da janela ${index + 1}`}
                              type="time"
                              value={windowDraft.endTime}
                              onChange={(event) =>
                                updateDayDraft((draft) => ({
                                  ...draft,
                                  windows: draft.windows.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, endTime: event.target.value }
                                        : item,
                                  ),
                                }))
                              }
                              slotProps={{ inputLabel: { shrink: true } }}
                            />
                            <Button
                              type="button"
                              variant="outlined"
                              color="error"
                              disabled={busy}
                              onClick={() =>
                                updateDayDraft((draft) => ({
                                  ...draft,
                                  windows: draft.windows.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                }))
                              }
                            >
                              Remover janela {index + 1}
                            </Button>
                          </Stack>
                        ))
                      )}

                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{ flexWrap: "wrap" }}
                      >
                        <Button
                          type="button"
                          variant="outlined"
                          disabled={busy}
                          onClick={() =>
                            updateDayDraft((draft) => ({
                              ...draft,
                              windows: [
                                ...draft.windows,
                                { ...DEFAULT_WINDOW },
                              ],
                            }))
                          }
                        >
                          Adicionar janela
                        </Button>
                      </Stack>

                      <TextField
                        select
                        fullWidth
                        label="Fuso horário"
                        value={dayDraft.timeZone}
                        onChange={(event) =>
                          updateDayDraft((draft) => ({
                            ...draft,
                            timeZone: event.target.value,
                          }))
                        }
                        helperText="Aplicado somente ao dia editado."
                        slotProps={{ select: { native: true } }}
                      >
                        {TIMEZONE_OPTIONS.map((timeZone) => (
                          <option key={timeZone} value={timeZone}>
                            {timeZone}
                          </option>
                        ))}
                      </TextField>

                      {availabilityError && (
                        <Alert
                          severity="error"
                          tabIndex={-1}
                          ref={availabilityErrorRef}
                        >
                          {availabilityError}
                        </Alert>
                      )}

                      <Typography variant="body2" color="text.secondary">
                        Cadastre ao menos um horário semanal para oferecer
                        sessões na página pública.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        A regra é semanal: a alteração vale para o dia escolhido
                        e não muda sessões já reservadas.
                      </Typography>

                      <Button
                        type="submit"
                        variant="contained"
                        disabled={busy}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Salvar disponibilidade de {WEEKDAYS[weekday]}
                      </Button>
                    </>
                  )}
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
            Sessões
          </Typography>
          <Stack spacing={2}>
            {visibleSessions.length === 0 && (
              <Typography color="text.secondary">
                Nenhuma sessão encontrada.
              </Typography>
            )}
            {visibleSessions.map((session) => (
              <Card key={session.id} variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      sx={{
                        justifyContent: "space-between",
                        alignItems: { sm: "center" },
                      }}
                      spacing={1}
                    >
                      <Box>
                        <SessionParticipant
                          name={session.menteeName}
                          email={session.menteeEmail}
                          member={session.menteeMember}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {formatMentorshipDate(
                            session.scheduledAt,
                            session.timeZone,
                          )}{" "}
                          · {session.timeZone}
                        </Typography>
                      </Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{ flexWrap: "wrap", alignItems: "center" }}
                      >
                        <Chip
                          size="small"
                          label={MENTORSHIP_STATUS_LABEL[session.status]}
                        />
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setLinkingSession(session)}
                        >
                          Vincular participante
                        </Button>
                      </Stack>
                    </Stack>
                    <Typography variant="body2">
                      {session.topicTags.join(", ")}
                    </Typography>
                    {session.status === "requested" && (
                      <TextField
                        label="Link da sessão"
                        type="url"
                        required
                        value={links[session.id] ?? ""}
                        onChange={(event) =>
                          setLinks({
                            ...links,
                            [session.id]: event.target.value,
                          })
                        }
                        slotProps={{ htmlInput: { pattern: "https://.*" } }}
                      />
                    )}
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{ flexWrap: "wrap" }}
                    >
                      {session.status === "requested" && (
                        <Button
                          variant="contained"
                          disabled={
                            busy || !links[session.id]?.startsWith("https://")
                          }
                          onClick={() =>
                            void mutate(
                              `/mentorship/sessions/${session.id}/confirm`,
                              { meetLink: links[session.id] },
                              "Sessão confirmada.",
                            )
                          }
                        >
                          Confirmar sessão
                        </Button>
                      )}
                      {session.status === "confirmed" && (
                        <>
                          <Button
                            variant="contained"
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                `/mentorship/sessions/${session.id}/complete`,
                                undefined,
                                "Sessão concluída; horas pendentes registradas.",
                              )
                            }
                          >
                            Concluir sessão
                          </Button>
                          <Button
                            variant="outlined"
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                `/mentorship/sessions/${session.id}/no-show`,
                                undefined,
                                "No-show registrado.",
                              )
                            }
                          >
                            Registrar no-show
                          </Button>
                        </>
                      )}
                    </Stack>
                    {["requested", "confirmed"].includes(session.status) && (
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                      >
                        <TextField
                          fullWidth
                          label="Motivo do cancelamento"
                          value={reasons[session.id] ?? ""}
                          onChange={(event) =>
                            setReasons({
                              ...reasons,
                              [session.id]: event.target.value,
                            })
                          }
                        />
                        <Button
                          color="error"
                          variant="outlined"
                          disabled={
                            busy ||
                            (reasons[session.id]?.trim().length ?? 0) < 3
                          }
                          onClick={() =>
                            void mutate(
                              `/mentorship/sessions/${session.id}/cancel`,
                              { reason: reasons[session.id] },
                              "Sessão cancelada.",
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            itemLabel="sessões"
          />
        </Box>
        {linkingSession && (
          <MenteeLinkDialog
            sessionId={linkingSession.id}
            authFetch={authFetch}
            onClose={() => setLinkingSession(null)}
            onSaved={() => {
              setFeedback("Participante vinculado.");
              void load();
            }}
          />
        )}
      </Stack>
    </PageContainer>
  );
}

export default function MentorDashboardIsland() {
  return (
    <MuiIslandProvider>
      <MentorDashboard />
    </MuiIslandProvider>
  );
}
