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
import BusinessIcon from "@mui/icons-material/Business";
import TokenIcon from "@mui/icons-material/Token";
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../../hooks/useAuth";
import { resolveCommunityFromPath } from "../../lib/community-context";

interface NavbarAuthProps {
  /** Passado automaticamente pelo Docusaurus quando renderizado no sidebar mobile. */
  mobile?: boolean;
  [key: string]: unknown;
}

export default function NavbarAuth({ mobile = false }: Readonly<NavbarAuthProps>): React.JSX.Element | null {
  const { user, ready, isLoggedIn, isAdmin, isFinanceAnalyzer, login, logout, authFetch } = useAuth();
  const canAccessAdmin = isAdmin || isFinanceAnalyzer;
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);

  // Evita mismatch SSR/CSR — só renderiza no cliente
  useEffect(() => { setMounted(true); }, []);

  // Verifica se o usuário logado é responsável por alguma empresa
  useEffect(() => {
    if (!isLoggedIn) { setHasCompany(false); return; }
    const parseJsonSafe = async <T,>(res: Response): Promise<T | null> => {
      if (!res.ok) return null;
      try {
        return (await res.json()) as T;
      } catch {
        return null;
      }
    };

    Promise.all([authFetch("/companies/me"), authFetch("/companies/my-collaborations")])
      .then(async ([ownedRes, collaborationsRes]) => {
        const owned = await parseJsonSafe<unknown>(ownedRes);
        const collaborations = await parseJsonSafe<unknown>(collaborationsRes);
        const hasCollaborations = Array.isArray(collaborations) && collaborations.length > 0;
        setHasCompany(!!owned || hasCollaborations);
      })
      .catch(() => setHasCompany(false));
  }, [isLoggedIn, authFetch]);

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
        <li className="menu__list-item">
          <a className="menu__link" href="/clube">Meu Clube</a>
        </li>
        {hasCompany && (
          <li className="menu__list-item">
            <a className="menu__link" href="/membros/empresa">Minha Empresa</a>
          </li>
        )}
        {canAccessAdmin && (
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
            onClick={() => login({ ...authOptions, switchAccount: true })}
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
            <SwitchAccountIcon style={{ fontSize: 16 }} />
            Trocar conta
          </button>
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
        <MenuItem component="a" href="/clube">
          <ListItemIcon><TokenIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Meu Clube</ListItemText>
        </MenuItem>
        {hasCompany && (
          <MenuItem component="a" href="/membros/empresa">
            <ListItemIcon><BusinessIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Minha Empresa</ListItemText>
          </MenuItem>
        )}
        {canAccessAdmin && (
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
        <MenuItem
          onClick={() => login({ ...authOptions, switchAccount: true })}
          sx={{ color: "text.secondary" }}
        >
          <ListItemIcon><SwitchAccountIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Trocar conta</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => logout(authOptions)} sx={{ color: "error.main" }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Sair</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
