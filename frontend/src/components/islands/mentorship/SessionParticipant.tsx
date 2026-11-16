import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { MenteeMember } from "../../../lib/mentorship";

interface SessionParticipantProps {
  name: string;
  email: string;
  member?: MenteeMember | null;
}

export default function SessionParticipant({ name, email, member = null }: Readonly<SessionParticipantProps>) {
  const displayName = member?.name ?? name;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar src={member?.avatarUrl} alt={displayName}>{displayName.charAt(0).toUpperCase()}</Avatar>
      <Box>
        {member ? (
          <Link href={`/@${member.githubHandle}`} underline="hover" color="inherit" sx={{ fontWeight: 700 }}>
            {displayName}
          </Link>
        ) : (
          <Typography sx={{ fontWeight: 700 }}>{displayName}</Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {member ? `@${member.githubHandle}` : "Não vinculado à plataforma"}
        </Typography>
        <Typography variant="body2" color="text.secondary">{email}</Typography>
      </Box>
    </Box>
  );
}
