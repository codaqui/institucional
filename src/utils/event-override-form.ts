import type { EventExtendData, EventSpeaker } from "./event-override";

/**
 * Helpers puros do formulário de override de eventos (`/admin/overrides`).
 * Separados da página para serem testáveis sem o runtime do Docusaurus.
 */

export const SUMMARY_MAX_LENGTH = 500;
export const TAGS_MAX = 10;
export const SPEAKERS_MAX = 10;
export const WORKLOAD_MAX_MINUTES = 1000;

/** Palestrante no estado do formulário, com id estável para renderização. */
export interface SpeakerFormItem extends EventSpeaker {
  id: string;
}

/** Estado do formulário de override (todos os campos como strings/listas). */
export interface OverrideFormState {
  title: string;
  summary: string;
  imageUrl: string;
  location: string;
  tags: string[];
  featured: boolean;
  speakers: SpeakerFormItem[];
  registrationUrl: string;
  slidesUrl: string;
  videoUrl: string;
  discussionUrl: string;
  workloadMinutes: string;
}

export const EMPTY_OVERRIDE_FORM: OverrideFormState = {
  title: "",
  summary: "",
  imageUrl: "",
  location: "",
  tags: [],
  featured: false,
  speakers: [],
  registrationUrl: "",
  slidesUrl: "",
  videoUrl: "",
  discussionUrl: "",
  workloadMinutes: "",
};

export function generateSpeakerId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Converte um `extendData` existente em estado de formulário (pré-preenchimento). */
export function formStateFromExtendData(
  data?: EventExtendData | null
): OverrideFormState {
  if (!data) {
    return { ...EMPTY_OVERRIDE_FORM, tags: [], speakers: [] };
  }
  return {
    title: data.title ?? "",
    summary: data.summary ?? "",
    imageUrl: data.imageUrl ?? "",
    location: data.location ?? "",
    tags: [...(data.tags ?? [])],
    featured: data.featured ?? false,
    speakers: (data.speakers ?? []).map((s) => ({ ...s, id: generateSpeakerId() })),
    registrationUrl: data.registrationUrl ?? "",
    slidesUrl: data.slidesUrl ?? "",
    videoUrl: data.videoUrl ?? "",
    discussionUrl: data.discussionUrl ?? "",
    workloadMinutes:
      typeof data.workloadMinutes === "number" && data.workloadMinutes > 0
        ? String(data.workloadMinutes)
        : "",
  };
}

const clean = (value: string): string => value.trim();

const cleanSpeaker = (speaker: EventSpeaker): EventSpeaker => {
  const out: EventSpeaker = { name: clean(speaker.name) };
  const handle = clean(speaker.handle ?? "");
  if (handle) out.handle = handle;
  const avatarUrl = clean(speaker.avatarUrl ?? "");
  if (avatarUrl) out.avatarUrl = avatarUrl;
  const talkTitle = clean(speaker.talkTitle ?? "");
  if (talkTitle) out.talkTitle = talkTitle;
  const profileUrl = clean(speaker.profileUrl ?? "");
  if (profileUrl) out.profileUrl = profileUrl;
  return out;
};

/**
 * Monta o `extendData` a partir do formulário: faz trim, remove campos
 * vazios e omite `featured` quando false (override mínimo no JSON).
 */
export function buildExtendData(form: OverrideFormState): EventExtendData {
  const data: EventExtendData = {};

  const title = clean(form.title);
  if (title) data.title = title;
  const summary = clean(form.summary);
  if (summary) data.summary = summary;
  const imageUrl = clean(form.imageUrl);
  if (imageUrl) data.imageUrl = imageUrl;
  const location = clean(form.location);
  if (location) data.location = location;

  const tags = form.tags.map(clean).filter(Boolean);
  if (tags.length > 0) data.tags = tags;

  if (form.featured) data.featured = true;

  const speakers = form.speakers
    .map((s) => cleanSpeaker(s))
    .filter((s) => s.name);
  if (speakers.length > 0) data.speakers = speakers;

  const registrationUrl = clean(form.registrationUrl);
  if (registrationUrl) data.registrationUrl = registrationUrl;
  const slidesUrl = clean(form.slidesUrl);
  if (slidesUrl) data.slidesUrl = slidesUrl;
  const videoUrl = clean(form.videoUrl);
  if (videoUrl) data.videoUrl = videoUrl;
  const discussionUrl = clean(form.discussionUrl);
  if (discussionUrl) data.discussionUrl = discussionUrl;

  // Carga horária (minutos): inteiro 0–1000; vazio/inválido/0 = omitido.
  const workload = Number.parseInt(clean(form.workloadMinutes), 10);
  if (!Number.isNaN(workload) && workload > 0 && workload <= WORKLOAD_MAX_MINUTES) {
    data.workloadMinutes = workload;
  }

  return data;
}

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

export interface EventCompleteness {
  percent: number;
  items: CompletenessItem[];
}

/**
 * Indicador de completude do evento (gamificação do painel do organizer):
 * imagem, descrição, tags, palestrantes, slides e gravação.
 */
export function computeCompleteness(form: OverrideFormState): EventCompleteness {
  const speakerCount = form.speakers.filter((s) => s.name.trim()).length;
  const items: CompletenessItem[] = [
    { key: "image", label: "Imagem do evento", done: !!clean(form.imageUrl) },
    { key: "summary", label: "Descrição", done: !!clean(form.summary) },
    { key: "tags", label: "Tags adicionadas", done: form.tags.length > 0 },
    {
      key: "speakers",
      label: "Palestrantes",
      done: speakerCount > 0,
      detail: speakerCount > 0 ? `${speakerCount} adicionado(s)` : undefined,
    },
    { key: "slides", label: "Slides (pós-evento)", done: !!clean(form.slidesUrl) },
    { key: "video", label: "Gravação (pós-evento)", done: !!clean(form.videoUrl) },
  ];
  const done = items.filter((item) => item.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

/**
 * Scope de ownership: `<source>:<sourceId>:<eventId|*>`
 * Ex.: `meetup:devparana:*`, `discord:codaqui:1234567890`.
 */
export const SCOPE_PATTERN = /^[^\s:]+:[^\s:]+:(?:\*|[^\s:]+)$/;
export const SCOPE_FORMAT_HINT =
  "Formato: <source>:<sourceId>:<eventId|*> — ex.: meetup:devparana:*";

export function isValidScope(scope: string): boolean {
  return SCOPE_PATTERN.test(scope.trim());
}

/** Monta o scope coringa (`*`) de uma fonte a partir do `sourceKey`. */
export function buildSourceWildcardScope(sourceKey: string): string {
  return `${sourceKey}:*`;
}
