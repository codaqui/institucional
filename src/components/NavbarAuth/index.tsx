import React, { useEffect, useState } from "react";
import { useLocation } from "@docusaurus/router";

import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import GitHubIcon from "@mui/icons-material/GitHub";
import PersonIcon from "@mui/icons-material/Person";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../../hooks/useAuth";
import { resolveCommunityFromPath } from "../../lib/community-context";

export default function NavbarAuth(): React.JSX.Element | null {
  const { user, ready, isLoggedIn, isAdmin, login, logout } = useAuth();
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  // Evita mismatch SSR/CSR — só renderiza no cliente
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !ready) return null;

  const authOptions = community
    ? { returnTo: community.basePath, communitySlug: community.slug }
    : undefined;

  if (!isLoggedIn) {
    return (
      <Button
        size="small"
        variant="outlined"
        startIcon={<GitHubIcon />}
        onClick={() => login(authOptions)}
        sx={{
          ml: 1,
          borderColor: "rgba(127,127,127,0.4)",
          color: "inherit",
          fontWeight: 600,
          fontSize: "0.8rem",
          textTransform: "none",
          py: 0.5,
          "&:hover": { borderColor: "primary.main", color: "primary.main" },
        }}
      >
        Entrar
      </Button>
    );
  }

  return (
    <>
      <Chip
        avatar={
          <Avatar
            src={user?.avatarUrl}
            alt={user?.name}
            sx={{ width: "22px !important", height: "22px !important" }}
          />
        }
        label={`@${user?.handle}`}
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          ml: 1,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.78rem",
          bgcolor: "action.hover",
          "&:hover": { bgcolor: "action.selected" },
        }}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 180 } } }}
      >
        <MenuItem component="a" href="/membro">
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Meu Perfil</ListItemText>
        </MenuItem>
        {isAdmin && (
          <MenuItem component="a" href="/admin">
            <ListItemIcon><AdminPanelSettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Painel Admin</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem component="a" href="/participe/apoiar">
          <ListItemText>Fazer uma Doação</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => logout(authOptions)} sx={{ color: "error.main" }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Sair</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
