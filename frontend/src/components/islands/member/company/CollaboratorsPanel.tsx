/**
 * Painel de colaboradores da empresa — lista com avatar/handle, adição por
 * GitHub handle e remoção (dono apenas). Port 1:1 do `CollaboratorsSection`
 * (MyCompanySection, Docusaurus).
 */
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import type { CompanyMember } from "./types";

interface CollaboratorsPanelProps {
  readonly collaborators: CompanyMember[];
  readonly isOwner: boolean;
  readonly isActive: boolean;
  readonly addHandle: string;
  readonly setAddHandle: (value: string) => void;
  readonly addError: string | null;
  readonly adding: boolean;
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
}

export default function CollaboratorsPanel({
  collaborators, isOwner, isActive,
  addHandle, setAddHandle, addError, adding, onAdd, onRemove,
}: CollaboratorsPanelProps): React.JSX.Element {
  return (
    <>
      <Typography variant="subtitle2" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
        Colaboradores
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Colaboradores podem ver o saldo e o histórico de transações da empresa.
      </Typography>

      <List dense disablePadding sx={{ mb: 2 }}>
        {collaborators.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Nenhum colaborador adicionado.
          </Typography>
        )}
        {collaborators.map((c) => (
          <ListItem
            key={c.id}
            disablePadding
            sx={{ py: 0.5 }}
            secondaryAction={
              isOwner ? (
                <IconButton size="small" onClick={() => onRemove(c.id)} aria-label="remover colaborador">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ) : undefined
            }
          >
            <ListItemAvatar>
              <Avatar
                src={`https://avatars.githubusercontent.com/${c.memberId}?size=32`}
                alt={c.memberId}
                sx={{ width: 32, height: 32 }}
              />
            </ListItemAvatar>
            <ListItemText
              primary={`@${c.memberId}`}
              secondary={`Desde ${new Date(c.addedAt).toLocaleDateString("pt-BR")}`}
            />
          </ListItem>
        ))}
      </List>

      {isOwner && isActive && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            label="GitHub handle do colaborador"
            value={addHandle}
            onChange={(e) => setAddHandle(e.target.value)}
            size="small"
            placeholder="ex: octocat"
            sx={{ flexGrow: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={adding ? <CircularProgress size={14} /> : <PersonAddIcon />}
            onClick={onAdd}
            disabled={adding || !addHandle.trim()}
            sx={{ whiteSpace: "nowrap", mt: 0.5 }}
          >
            Adicionar
          </Button>
        </Box>
      )}
      {addError && <Alert severity="error" sx={{ mt: 1 }}>{addError}</Alert>}
    </>
  );
}
