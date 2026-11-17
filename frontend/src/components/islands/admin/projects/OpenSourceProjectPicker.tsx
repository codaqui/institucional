import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { projects, type Project } from "../../../../data/projects";

interface OpenSourceProjectPickerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelect: (project: Project) => void;
}

export default function OpenSourceProjectPicker({
  open,
  onClose,
  onSelect,
}: OpenSourceProjectPickerProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return projects;
    return projects.filter((project) =>
      `${project.title} ${project.description}`.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [search]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Importar da vitrine open source</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Buscar projeto da vitrine"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            helperText="A escolha só preenche o formulário; nada é criado antes de salvar."
          />
          {filtered.length === 0 && <Typography color="text.secondary">Nenhum projeto encontrado.</Typography>}
          {filtered.map((project) => (
            <Stack key={project.href} spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{project.title}</Typography>
              <Typography variant="body2" color="text.secondary">{project.description}</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="outlined" onClick={() => onSelect(project)}>Usar {project.title}</Button>
                <Link href={project.href} target="_blank" rel="noopener noreferrer">Abrir repositório de {project.title}</Link>
              </Stack>
              <Divider />
            </Stack>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
