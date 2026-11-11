import { useState } from "react";
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";

export interface AdminMentor {
  id: string;
  memberId: string;
  name: string;
  githubHandle: string;
  avatarUrl: string;
  areas: string[];
  focus: string | null;
  active: boolean;
  isPlaceholder: boolean;
}

export interface MentorMemberOption {
  id: string;
  name: string;
  githubHandle: string;
  isActive: boolean;
}

export interface UpdateMentorInput {
  memberId: string;
  areas: string[];
  focus: string;
  active: boolean;
}

interface MentorEditorDialogProps {
  mentor: AdminMentor;
  members: MentorMemberOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: UpdateMentorInput) => Promise<boolean>;
}

export default function MentorEditorDialog({ mentor, members, saving, onClose, onSave }: Readonly<MentorEditorDialogProps>) {
  const currentMember: MentorMemberOption = {
    id: mentor.memberId,
    name: mentor.name,
    githubHandle: mentor.githubHandle,
    isActive: !mentor.isPlaceholder,
  };
  const [member, setMember] = useState<MentorMemberOption>(currentMember);
  const [areas, setAreas] = useState(mentor.areas.join(", "));
  const [focus, setFocus] = useState(mentor.focus ?? "");
  const [active, setActive] = useState(mentor.active);
  const [confirming, setConfirming] = useState(false);
  const options = members.some((option) => option.id === currentMember.id) ? members : [currentMember, ...members];

  const input = (): UpdateMentorInput => ({
    memberId: member.id,
    areas: areas.split(",").map((area) => area.trim()).filter(Boolean),
    focus,
    active,
  });
  const save = async () => {
    if (await onSave(input())) onClose();
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="mentor-editor-title">
      <Box component="form" aria-labelledby="mentor-editor-title" onSubmit={(event) => {
        event.preventDefault();
        if (member.id !== mentor.memberId) setConfirming(true);
        else void save();
      }}>
        <DialogTitle id="mentor-editor-title">Editar mentor — {mentor.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {mentor.isPlaceholder && <Alert severity="info">Este perfil pertence a um placeholder histórico. Selecione a conta ativa correta para reatribuí-lo sem perder as sessões.</Alert>}
            {confirming && <Alert severity="warning">A reatribuição preserva o histórico no perfil e altera a designation de mentoria de {mentor.name} para {member.name}.</Alert>}
            <Autocomplete
              options={options}
              value={member}
              onChange={(_event, option) => { if (option) { setMember(option); setConfirming(false); } }}
              getOptionLabel={(option) => `${option.name} (@${option.githubHandle})`}
              getOptionDisabled={(option) => !option.isActive && option.id !== mentor.memberId}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Membro vinculado" required />}
            />
            <TextField
              label="Áreas"
              name="areas"
              value={areas}
              onChange={(event) => setAreas(event.target.value)}
              helperText="Separe as áreas por vírgulas."
              required
            />
            <TextField
              label="Foco"
              name="focus"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              multiline
              minRows={2}
            />
            <FormControlLabel
              control={<Switch checked={active} onChange={(event) => setActive(event.target.checked)} name="active" />}
              label="Mentor ativo"
            />
            <Typography variant="body2" color="text.secondary">Mentores ativos recebem a designation de mentoria e podem aparecer no diretório público.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          {confirming ? <>
            <Button type="button" disabled={saving} onClick={() => setConfirming(false)}>Revisar dados</Button>
            <Button type="button" variant="contained" disabled={saving} onClick={() => void save()}>Confirmar reatribuição</Button>
          </> : <>
            <Button type="button" disabled={saving} onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>Salvar mentor</Button>
          </>}
        </DialogActions>
      </Box>
    </Dialog>
  );
}
