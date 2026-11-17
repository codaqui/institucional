import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { AuthUser } from "../../../../lib/auth-client";

interface VisibilityField {
  readonly key: string;
  readonly label: string;
  readonly source: string;
  readonly purpose: string;
}

interface ProfileVisibilityPreviewProps {
  readonly user: AuthUser;
  readonly visibility: Record<string, boolean>;
  readonly fields: readonly VisibilityField[];
}

export default function ProfileVisibilityPreview({
  user,
  visibility,
  fields,
}: Readonly<ProfileVisibilityPreviewProps>): React.JSX.Element {
  const visibleFields = fields.filter((field) => visibility[field.key]);

  return (
    <Box component="section" role="region" aria-label="Prévia do perfil público">
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }} gutterBottom>
            Prévia
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
            <Avatar src={user.avatarUrl} alt={`Avatar de ${user.name}`} />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{user.name}</Typography>
              <Typography variant="body2" color="text.secondary">@{user.handle}</Typography>
            </Box>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Campos habilitados para o próximo refresh/build:
          </Typography>
          <Stack component="ul" sx={{ pl: 2, my: 0 }}>
            {visibleFields.map((field) => (
              <Typography component="li" variant="body2" key={field.key}>{field.label}</Typography>
            ))}
          </Stack>
          {visibleFields.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nenhum campo opcional habilitado.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
