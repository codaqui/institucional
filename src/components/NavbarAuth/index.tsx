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

interface NavbarAuthProps {
  /** Passado automaticamente pelo Docusaurus quando renderizado no sidebar mobile. */
  mobile?: boolean;
  [key: string]: unknown;
}

export default function NavbarAuth({ mobile = false }: NavbarAuthProps): React.JSX.Element | null {
  const { user, ready, isLoggedIn, isAdmin, login, logout } = useAuth();
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  // Evita mismatch SSR/CSR — só renderiza no cliente
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !ready) return null;

  const authOptions = community
    ? { returnTo: pathname, communitySlug: community.slug }
    : undefined;

  // ── Renderização mobile (sidebar hambúrguer) ──────────────────────────────
  // Usa classes Docusaurus (menu__list-item / menu__link) para manter
  // consistência visual com os outros itens do sidebar.
  if (mobile) {
    if (!isLoggedIn) {
      return (
        <li className="menu__list-item">
          <button
            type="button"
            className="menu__link"
            onClick={() => login(authOptions)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              background: "none",
              border: "none",
              width: "100%",
              textAlign: "left",
              font: "inherit",
            }}
          >
            <GitHubIcon style={{ fontSize: 16 }} />
            Entrar com GitHub
          </button>
        </li>
      );
    }

    return (
      <>
        <li className="menu__list-item">
          <span
            style={{
              display: "block",
              padding: "var(--ifm-menu-link-padding-vertical) var(--ifm-menu-link-padding-horizontal)",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "var(--ifm-menu-color)",
            }}
          >
            @{user?.handle}
          </span>
        </li>
        <li className="menu__list-item">
          <a className="menu__link" href="/membro">Meu Perfil</a>
        </li>
        {isAdmin && (
          <li className="menu__list-item">
            <a className="menu__link" href="/admin">Painel Admin</a>
          </li>
        )}
        <li className="menu__list-item">
          <a className="menu__link" href="/participe/apoiar">Fazer uma Doação</a>
        </li>
        <li className="menu__list-item">
          <button
            type="button"
            className="menu__link"
            onClick={() => logout(authOptions)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              background: "none",
              border: "none",
              width: "100%",
              textAlign: "left",
              font: "inherit",
              color: "var(--ifm-color-danger)",
            }}
          >
            <LogoutIcon style={{ fontSize: 16 }} />
            Sair
          </button>
        </li>
      </>
    );
  }

  // ── Renderização desktop ──────────────────────────────────────────────────
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
