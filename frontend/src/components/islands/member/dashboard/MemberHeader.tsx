/**
 * Header do dashboard do membro: cartão de perfil (avatar, papéis, ações)
 * + dialog com o QR Code da vanity URL.
 * Port de `MemberProfileCard`/`MemberQrDialog` em `src/pages/membro/index.tsx`.
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
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { QRCodeSVG } from "qrcode.react";
import type { AuthUser } from "../../../../lib/auth-client";
import {
  getRoleColor,
  getRoleLabel,
  getUserRoles,
} from "./types";

interface MemberProfileCardProps {
  readonly user: AuthUser;
  readonly vanityUrl: string;
  readonly copied: boolean;
  readonly canAccessReimbursements: boolean;
  readonly onCopy: () => void;
  readonly onShowQr: () => void;
  readonly onLogout: () => void;
}

export function MemberProfileCard({
  user,
  vanityUrl,
  copied,
  canAccessReimbursements,
  onCopy,
  onShowQr,
  onLogout,
}: MemberProfileCardProps): React.JSX.Element {
  const roles = getUserRoles(user);

  return (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 80, height: 80 }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5, flexWrap: "wrap" }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <GitHubIcon sx={{ fontSize: "0.9rem", mr: 0.5, verticalAlign: "middle" }} />
            @{user.handle}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
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
            <Tooltip title="Exibir QR Code do perfil">
              <IconButton size="small" onClick={onShowQr} aria-label="Exibir QR Code">
                <QrCode2Icon />
              </IconButton>
            </Tooltip>
            {canAccessReimbursements && (
              <Button variant="outlined" size="small" color="secondary" href="/admin/reembolsos">
                Painel de Reembolsos
              </Button>
            )}
            <Button
              variant="text"
              size="small"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={{ color: "text.secondary" }}
            >
              Sair
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {vanityUrl}
            </Typography>
            <Tooltip title={copied ? "Copiado!" : "Copiar URL"}>
              <IconButton size="small" onClick={onCopy} aria-label="Copiar URL do perfil">
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
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
