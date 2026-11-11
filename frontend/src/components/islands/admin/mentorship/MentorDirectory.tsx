import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import PaginationControls from "../../ui/PaginationControls";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE, rangeLabel, type PaginatedResponse } from "../../../../lib/pagination";
import MentorEditorDialog, { type AdminMentor, type MentorMemberOption, type UpdateMentorInput } from "./MentorEditorDialog";

interface MentorDirectoryProps {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onError: (message: string) => void;
  onFeedback: (message: string) => void;
}

export default function MentorDirectory({ authFetch, onError, onFeedback }: Readonly<MentorDirectoryProps>) {
  const [mentors, setMentors] = useState<AdminMentor[]>([]);
  const [members, setMembers] = useState<MentorMemberOption[]>([]);
  const [editing, setEditing] = useState<AdminMentor | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadMentors = useCallback(async () => {
    const response = await authFetch(`/mentorship/admin/mentors?page=${page}&limit=${DEFAULT_PAGE_SIZE}`);
    const result = await parseAuthJson<PaginatedResponse<AdminMentor>>(response, onError);
    if (result) {
      setMentors(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    }
  }, [authFetch, onError, page]);

  useEffect(() => {
    void loadMentors().catch(() => onError("Não foi possível carregar os mentores."));
  }, [loadMentors, onError]);

  useEffect(() => {
    const loadMembers = async () => {
      const response = await authFetch("/admin/members");
      const result = await parseAuthJson<MentorMemberOption[]>(response, onError);
      if (result) setMembers(result.filter((member) => member.isActive));
    };
    void loadMembers().catch(() => onError("Não foi possível carregar os membros ativos."));
  }, [authFetch, onError]);

  const saveMentor = async (input: UpdateMentorInput) => {
    if (!editing) return false;
    setSaving(true);
    onError("");
    onFeedback("");
    try {
      const response = await authFetch(`/mentorship/admin/mentors/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        onError(await extractErrorMessage(response, "Não foi possível atualizar o mentor."));
        return false;
      }
      onFeedback("Mentor atualizado com vínculo e designation sincronizados.");
      await loadMentors();
      return true;
    } catch {
      onError("Não foi possível atualizar o mentor.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="section" aria-labelledby="mentor-directory-title">
      <Typography id="mentor-directory-title" variant="h5" component="h3" sx={{ mb: 2 }}>Mentores e vínculos</Typography>
      <Stack spacing={1} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {mentors.length === 0 ? <Typography color="text.secondary">Nenhum mentor encontrado.</Typography> : mentors.map((mentor) => (
          <Card key={mentor.id} variant="outlined" component="li"><CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }} spacing={1}>
              <Box>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                  <Typography sx={{ fontWeight: 700 }}>{mentor.name}</Typography>
                  <Chip size="small" label={mentor.active ? "Ativo" : "Inativo"} color={mentor.active ? "success" : "default"} />
                  {mentor.isPlaceholder && <Chip size="small" label="Placeholder histórico" color="warning" variant="outlined" />}
                </Stack>
                <Typography variant="body2" color="text.secondary">@{mentor.githubHandle} · {mentor.areas.join(", ")}</Typography>
                {mentor.focus && <Typography variant="body2">{mentor.focus}</Typography>}
              </Box>
              <Button variant="outlined" aria-label={`Editar mentor ${mentor.name}`} onClick={() => setEditing(mentor)}>Editar</Button>
            </Stack>
          </CardContent></Card>
        ))}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", my: 1 }}>{rangeLabel(page, DEFAULT_PAGE_SIZE, total)}</Typography>
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="mentores" />
      {editing && <MentorEditorDialog
        key={editing.id}
        mentor={editing}
        members={members}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={saveMentor}
      />}
    </Box>
  );
}
