/**
 * Identidade compacta do membro e dialog reutilizável do QR da vanity URL.
 */
import { useTheme } from "@mui/material/styles";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import GitHubIcon from "@mui/icons-material/GitHub";
import PersonIcon from "@mui/icons-material/Person";
import { QRCodeSVG } from "qrcode.react";
import type { AuthUser } from "../../../../lib/auth-client";
import {
  getRoleColor,
  getRoleLabel,
  getUserRoles,
} from "./types";

interface MemberProfileCardProps {
  readonly user: AuthUser;
}

export function MemberProfileCard({ user }: MemberProfileCardProps): React.JSX.Element {
  const roles = getUserRoles(user);

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
          "&:last-child": { pb: 2 },
        }}
      >
        <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 56, height: 56 }} />
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography component="h1" variant="h6" sx={{ fontWeight: 800 }}>
              {user.name}
            </Typography>
            {roles.map((role) => (
              <Chip
                key={role}
                label={getRoleLabel(role)}
                color={getRoleColor(role)}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">
            <GitHubIcon sx={{ fontSize: "0.9rem", mr: 0.5, verticalAlign: "middle" }} />
            @{user.handle}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" size="small" startIcon={<EditIcon />} href="/membro/editar">
            Editar perfil
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PersonIcon />}
            href={`/@${user.handle}`}
          >
            Ver perfil público
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

interface MemberQrDialogProps {
  readonly open: boolean;
  readonly vanityUrl: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onClose: () => void;
}

export function MemberQrDialog({
  open,
  vanityUrl,
  copied,
  onCopy,
  onClose,
}: MemberQrDialogProps): React.JSX.Element {
  // Zero hex: cor de marca vem do tema (o original usava um verde hardcoded).
  const theme = useTheme();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: "center", fontWeight: 700 }}>Seu QR Code</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pb: 3 }}
      >
        <Box sx={{ bgcolor: "white", p: 2, borderRadius: 2, display: "inline-block" }}>
          <QRCodeSVG
            value={vanityUrl}
            size={200}
            level="M"
            marginSize={0}
            fgColor={theme.palette.success.main}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
          Escaneie para acessar seu perfil público
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: "monospace" }} color="text.secondary">
            {vanityUrl}
          </Typography>
          <Tooltip title={copied ? "Copiado!" : "Copiar"}>
            <IconButton size="small" onClick={onCopy} aria-label="Copiar URL">
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
