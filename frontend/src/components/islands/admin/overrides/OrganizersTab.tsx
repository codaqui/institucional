/**
 * Port da aba 2 (`OrganizersTab`) de `src/pages/admin/overrides.tsx`
 * (Docusaurus) — mapeamento de ownership de eventos externos (somente admin).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  parseAuthJson,
  extractErrorMessage,
} from "../../../../lib/auth-fetch-helpers";
import ModalConfirm from "../ui/ModalConfirm";
import {
  SCOPE_FORMAT_HINT,
  buildSourceWildcardScope,
  isValidScope,
} from "./override-form";
import type {
  AuthFetch,
  EventSourceSummary,
  Member,
  OrganizersFile,
  Ownership,
} from "./shared";

interface OrganizersTabProps {
  readonly authFetch: AuthFetch;
  readonly sources: EventSourceSummary[];
}

export default function OrganizersTab({
  authFetch,
  sources,
}: OrganizersTabProps): JSX.Element {
  const [data, setData] = useState<OrganizersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Busca server-side de membros (staff-candidates) — sem dump de /admin/members.
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberOptions, setMemberOptions] = useState<Member[]>([]);
  const [membersSearching, setMembersSearching] = useState(false);

  const [memberId, setMemberId] = useState("");
  const [githubHandle, setGithubHandle] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [newScope, setNewScope] = useState("");
  const [scopeError, setScopeError] = useState("");
  const [helperSource, setHelperSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Ownership | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const orgRes = await authFetch("/events/organizers");
      const org = await parseAuthJson<OrganizersFile>(orgRes, setLoadError);
      if (org) setData(org);
    } catch {
      setLoadError("Erro inesperado ao carregar organizers.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Busca debounced (≥2 chars) em /events/staff-candidates (máx 20 resultados).
  useEffect(() => {
    const q = memberQuery.trim();
    if (q.length < 2) {
      setMemberOptions([]);
      return;
    }
    let cancelled = false;
    setMembersSearching(true);
    const timer = setTimeout(() => {
      authFetch(`/events/staff-candidates?query=${encodeURIComponent(q)}`)
        .then(async (res) => {
          if (cancelled || !res.ok) return;
          const members = (await res.json()) as Member[];
          setMemberOptions(Array.isArray(members) ? members : []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setMembersSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberQuery, authFetch]);

  // Garante que o membro selecionado continue nas opções (evita warning do MUI).
  const autocompleteOptions = useMemo(
    () =>
      selectedMember && !memberOptions.some((m) => m.id === selectedMember.id)
        ? [selectedMember, ...memberOptions]
        : memberOptions,
    [selectedMember, memberOptions],
  );

  const addScope = (raw: string) => {
    const scope = raw.trim();
    if (!isValidScope(scope)) {
      setScopeError(SCOPE_FORMAT_HINT);
      return;
    }
    if (scopes.includes(scope)) {
      setScopeError("Scope já adicionado.");
      return;
    }
    setScopes((prev) => [...prev, scope]);
    setNewScope("");
    setScopeError("");
  };

  const handleAddOwnership = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const res = await authFetch(`/events/organizers/${encodeURIComponent(memberId)}`, {
        method: "POST",
        body: JSON.stringify({ githubHandle: githubHandle.trim(), scope: scopes }),
      });
      if (!res.ok) {
        setSaveError(await extractErrorMessage(res, "Erro ao adicionar organizer."));
        return;
      }
      setSaveSuccess("Ownership salva com sucesso.");
      setSelectedMember(null);
      setMemberQuery("");
      setMemberOptions([]);
      setMemberId("");
      setGithubHandle("");
      setScopes([]);
      setNewScope("");
      fetchAll();
    } catch {
      setSaveError("Erro inesperado ao adicionar organizer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await authFetch(`/events/organizers/${deleteTarget.memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(await extractErrorMessage(res, "Erro ao remover ownership."));
        return;
      }
      setDeleteTarget(null);
      fetchAll();
    } catch {
      setDeleteError("Erro inesperado ao remover ownership.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        O mapeamento de ownership define quais eventos externos cada <code>event_organizer</code>{" "}
        pode editar. Escopos: <code>source:sourceId:eventId</code> (evento específico) ou{" "}
        <code>source:sourceId:*</code> (toda a fonte).
      </Alert>

      {saveSuccess && <Alert severity="success">{saveSuccess}</Alert>}

      {loadError && <Alert severity="error">{loadError}</Alert>}

      {/* Lista de ownerships */}
      {!data || data.ownerships.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
          Nenhum organizer mapeado ainda.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {data.ownerships.map((o) => (
            <Card key={o.memberId} variant="outlined">
              <CardContent sx={{ pb: "16px !important" }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      src={`https://avatars.githubusercontent.com/${o.githubHandle}?v=4`}
                      alt={o.githubHandle}
                      sx={{ width: 36, height: 36 }}
                    />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        @{o.githubHandle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {o.memberId}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Remover ownership de @${o.githubHandle}`}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(o);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                  {o.scope.map((s) => (
                    <Chip key={s} label={s} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Adicionar ownership */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            Adicionar organizer
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={autocompleteOptions}
              value={selectedMember}
              inputValue={memberQuery}
              onInputChange={(_, v, reason) => {
                if (reason === "input") setMemberQuery(v);
              }}
              onChange={(_, member) => {
                setSelectedMember(member);
                setMemberId(member?.id ?? "");
                setGithubHandle(member?.githubHandle ?? "");
              }}
              filterOptions={(x) => x}
              loading={membersSearching}
              getOptionLabel={(m) => `${m.name} · @${m.githubHandle}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={
                memberQuery.trim().length < 2
                  ? "Digite ao menos 2 caracteres para buscar"
                  : "Nenhum membro encontrado"
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Membro"
                  placeholder="Buscar por nome ou handle do GitHub..."
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {membersSearching ? <CircularProgress size={16} /> : null}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
              renderOption={(props, m) => {
                const { key, ...liProps } = props;
                return (
                  <li key={key} {...liProps}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar src={m.avatarUrl} alt={m.name} sx={{ width: 28, height: 28 }} />
                      <Box>
                        <Typography variant="body2">{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{m.githubHandle}
                        </Typography>
                      </Box>
                    </Box>
                  </li>
                );
              }}
            />

            {selectedMember && !(selectedMember.roles ?? []).includes("event_organizer") && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Este membro ainda não possui a role <code>event_organizer</code>. Adicione-a em
                "Administração → Membros" antes de salvar, ou a ownership não terá efeito.
              </Alert>
            )}

            <TextField
              label="Handle do GitHub"
              value={githubHandle}
              onChange={(e) => setGithubHandle(e.target.value)}
              fullWidth
              helperText="Pré-preenchido a partir do membro selecionado"
            />

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }} gutterBottom>
                Escopos
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {scopes.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onDelete={() => setScopes((prev) => prev.filter((x) => x !== s))}
                  />
                ))}
                {scopes.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Nenhum escopo adicionado.
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                <TextField
                  label="Novo escopo"
                  value={newScope}
                  onChange={(e) => {
                    setNewScope(e.target.value);
                    setScopeError("");
                  }}
                  error={!!scopeError}
                  helperText={scopeError || SCOPE_FORMAT_HINT}
                  size="small"
                  sx={{ flex: 1, minWidth: 260 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addScope(newScope);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addScope(newScope)}
                  sx={{ mt: 0.5 }}
                >
                  Adicionar
                </Button>
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1, flexWrap: "wrap" }}>
                <TextField
                  select
                  label="Ou montar a partir da fonte"
                  value={helperSource}
                  onChange={(e) => setHelperSource(e.target.value)}
                  size="small"
                  sx={{ minWidth: 260 }}
                >
                  {sources.map((s) => (
                    <MenuItem key={s.sourceKey} value={s.sourceKey}>
                      {s.emoji} {s.label} ({s.sourceKey})
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  size="small"
                  variant="text"
                  disabled={!helperSource}
                  onClick={() => addScope(buildSourceWildcardScope(helperSource))}
                >
                  Adicionar {helperSource ? buildSourceWildcardScope(helperSource) : "…"}
                </Button>
              </Box>
            </Box>

            {saveError && <Alert severity="error">{saveError}</Alert>}

            <Button
              variant="contained"
              disabled={saving || !memberId || !githubHandle.trim() || scopes.length === 0}
              onClick={handleAddOwnership}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ alignSelf: "flex-start" }}
            >
              Salvar organizer
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <ModalConfirm
        open={!!deleteTarget}
        title="Remover ownership?"
        description={`@${deleteTarget?.githubHandle} perderá a permissão de editar os eventos dos escopos mapeados. A remoção é imediata.`}
        confirmLabel="Remover ownership"
        variant="error"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Stack>
  );
}
