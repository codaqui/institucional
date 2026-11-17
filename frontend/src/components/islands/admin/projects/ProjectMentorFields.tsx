import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useAuth } from "../../../../lib/use-auth";
import type { ProjectMemberOption } from "./project-form";

interface ProjectMentorFieldsProps {
  readonly mentor: ProjectMemberOption | null;
  readonly coMentors: ProjectMemberOption[];
  readonly onChange: (
    mentor: ProjectMemberOption | null,
    coMentors: ProjectMemberOption[],
  ) => void;
  readonly disabled?: boolean;
}

const memberLabel = (member: ProjectMemberOption) =>
  `${member.name} (@${member.githubHandle})`;

export default function ProjectMentorFields({
  mentor,
  coMentors,
  onChange,
  disabled = false,
}: ProjectMentorFieldsProps): React.JSX.Element {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectMemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const response = await authFetch(
          `/mentorship/member-options?search=${encodeURIComponent(query.trim())}`,
        );
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as ProjectMemberOption[];
        if (active) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (active) setSearchError("Não foi possível buscar membros.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authFetch, query]);

  const options = useMemo(() => {
    const byId = new Map<string, ProjectMemberOption>();
    for (const member of [
      ...results,
      ...coMentors,
      ...(mentor ? [mentor] : []),
    ]) {
      byId.set(member.id, member);
    }
    return [...byId.values()];
  }, [results, mentor, coMentors]);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Autocomplete<ProjectMemberOption, false, false, false>
        fullWidth
        value={mentor}
        options={options}
        getOptionLabel={memberLabel}
        filterOptions={(currentOptions) => currentOptions}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_, value) =>
          onChange(
            value,
            coMentors.filter((member) => member.id !== value?.id),
          )
        }
        onInputChange={(_, value) => setQuery(value)}
        loading={loading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Mentor principal"
            helperText={searchError || "Busque por nome ou handle."}
            error={Boolean(searchError)}
          />
        )}
      />
      <Autocomplete<ProjectMemberOption, true, false, false>
        fullWidth
        multiple
        value={coMentors}
        options={options}
        getOptionLabel={memberLabel}
        filterOptions={(currentOptions) => currentOptions}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_, value) =>
          onChange(
            mentor,
            value.filter((member) => member.id !== mentor?.id),
          )
        }
        onInputChange={(_, value) => setQuery(value)}
        loading={loading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Co-mentores"
            helperText={searchError || "Opcional; busque por nome ou handle."}
            error={Boolean(searchError)}
          />
        )}
      />
    </Stack>
  );
}
