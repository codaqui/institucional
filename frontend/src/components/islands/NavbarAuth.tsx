import { useEffect, useState, type ReactNode } from "react";
import {
  Avatar,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BusinessIcon from "@mui/icons-material/Business";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import TokenIcon from "@mui/icons-material/Token";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";

/**
 * Menu da conta no header — restore do port do Docusaurus.
 *
 * Duas variantes (a ilha é montada nos dois lugares pelo SiteHeader):
 * - `dropdown` (default, header desktop): avatar clicável abre um Menu MUI
 *   ancorado nele (completo: header @handle, itens por papel, ESC/outside).
 * - `inline` (rodapé do drawer mobile): a mesma lista expandida como links
 *   de navegação (guia `menu`: lista de links com Tab = navegação, sem
 *   role="menu" — o papel de menu exigiria um botão trigger).
 */

export interface NavbarAuthProps {
  readonly variant?: "dropdown" | "inline";
}

interface AccountMenuEntry {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
}

/** href do Painel Admin por papel — espelha a sidebar (AppNavIsland). */
export function resolveAdminHref(auth: {
  isAdmin: boolean;
  isFinanceAnalyzer: boolean;
  isEventOrganizer: boolean;
  isEventHost: boolean;
  isEventChecker: boolean;
}): string {
  if (auth.isAdmin || auth.isFinanceAnalyzer) return "/admin";
  if (auth.isEventOrganizer) return "/admin/eventos";
  if (auth.isEventHost || auth.isEventChecker) return "/admin/eventos-checkin";
  return "/admin";
}

function useHasCompany(
  enabled: boolean,
  authFetch: (path: string, init?: RequestInit) => Promise<Response>,
): boolean {
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Tolerante a erro: qualquer falha deixa hasCompany=false — o menu
    // nunca quebra por causa desta consulta.
    Promise.all([authFetch("/companies/me"), authFetch("/companies/my-collaborations")])
      .then(async ([ownedRes, collabRes]) => {
        const owned = ownedRes.ok;
        let collabCount = 0;
        try {
          const data: unknown = await collabRes.json();
          collabCount = Array.isArray(data)
            ? data.length
            : Array.isArray((data as { items?: unknown[] } | null)?.items)
              ? ((data as { items: unknown[] }).items?.length ?? 0)
              : 0;
        } catch {
          collabCount = 0;
        }
        if (!cancelled) setHasCompany(owned || collabCount > 0);
      })
      .catch(() => {
        if (!cancelled) setHasCompany(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, authFetch]);

  return hasCompany;
}

function NavbarAuthInner({ variant = "dropdown" }: NavbarAuthProps) {
  const {
    user,
    ready,
    isLoggedIn,
    isAdmin,
    isFinanceAnalyzer,
    isEventOrganizer,
    isEventFinance,
    isEventHost,
    isEventChecker,
    login,
    logout,
    authFetch,
  } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hasCompany = useHasCompany(Boolean(isLoggedIn && user), authFetch);

  if (!ready) {
    return <span className="inline-block h-9 w-24 animate-pulse rounded-md bg-sunken" />;
  }

  if (!isLoggedIn || !user) {
    return (
      <Button variant="contained" size="small" onClick={() => login()}>
        Entrar com GitHub
      </Button>
    );
  }

  const canAccessAdmin =
    isAdmin ||
    isFinanceAnalyzer ||
    isEventOrganizer ||
    isEventFinance ||
    isEventHost ||
    isEventChecker;

  const closeMenu = () => setAnchorEl(null);

  const primaryEntries: AccountMenuEntry[] = [
    { key: "perfil", label: "Meu Perfil", href: "/membro", icon: <PersonIcon fontSize="small" /> },
    { key: "clube", label: "Meu Clube", href: "/clube", icon: <TokenIcon fontSize="small" /> },
    ...(hasCompany
      ? [
          {
            key: "empresa",
            label: "Minha Empresa",
            href: "/membros/empresa",
            icon: <BusinessIcon fontSize="small" />,
          } satisfies AccountMenuEntry,
        ]
      : []),
    ...(canAccessAdmin
      ? [
          {
            key: "admin",
            label: "Painel Admin",
            href: resolveAdminHref({
              isAdmin,
              isFinanceAnalyzer,
              isEventOrganizer,
              isEventHost,
              isEventChecker,
            }),
            icon: <AdminPanelSettingsIcon fontSize="small" />,
          } satisfies AccountMenuEntry,
        ]
      : []),
  ];
  const donationEntries: AccountMenuEntry[] = [
    { key: "doacao", label: "Fazer uma Doação", href: "/participe/apoiar", icon: null },
  ];
  const sessionEntries: AccountMenuEntry[] = [
    {
      key: "trocar",
      label: "Trocar conta",
      icon: <SwitchAccountIcon fontSize="small" />,
      onSelect: () => login({ switchAccount: true }),
    },
    {
      key: "sair",
      label: "Sair",
      icon: <LogoutIcon fontSize="small" color="error" />,
      onSelect: () => logout({ returnTo: "/" }),
      danger: true,
    },
  ];

  const accountHeader = (
    <div className="flex items-center gap-2 px-3 py-2">
      <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 32, height: 32 }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        @{user.handle}
      </Typography>
    </div>
  );

  if (variant === "inline") {
    // Drawer mobile: lista expandida como navegação.
    const linkClass =
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-text-primary no-underline hover:bg-sunken";
    const renderInline = (entry: AccountMenuEntry) =>
      entry.href ? (
        <a key={entry.key} href={entry.href} className={linkClass}>
          <span className="inline-flex w-6 justify-center text-text-secondary">{entry.icon}</span>
          {entry.label}
        </a>
      ) : (
        <button
          key={entry.key}
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-text-primary hover:bg-sunken"
          style={entry.danger ? { color: "var(--cq-color-error)" } : undefined}
          onClick={entry.onSelect}
        >
          <span className="inline-flex w-6 justify-center">{entry.icon}</span>
          {entry.label}
        </button>
      );

    return (
      <nav aria-label="Menu da conta" className="flex w-full flex-col gap-1">
        {accountHeader}
        {primaryEntries.map(renderInline)}
        <hr className="my-1 border-border" />
        {donationEntries.map(renderInline)}
        <hr className="my-1 border-border" />
        {sessionEntries.map(renderInline)}
      </nav>
    );
  }

  const menuOpen = Boolean(anchorEl);

  const renderMenuItem = (entry: AccountMenuEntry) =>
    entry.href ? (
      <MenuItem key={entry.key} component="a" href={entry.href} onClick={closeMenu}>
        <ListItemIcon>{entry.icon}</ListItemIcon>
        <ListItemText>{entry.label}</ListItemText>
      </MenuItem>
    ) : (
      <MenuItem
        key={entry.key}
        onClick={() => {
          closeMenu();
          entry.onSelect?.();
        }}
      >
        <ListItemIcon>{entry.icon}</ListItemIcon>
        <ListItemText sx={entry.danger ? { color: "error.main" } : undefined}>
          {entry.label}
        </ListItemText>
      </MenuItem>
    );

  return (
    <>
      <IconButton
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Menu da conta @${user.handle}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        size="small"
        sx={{ p: 0.5 }}
      >
        <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 28, height: 28 }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {accountHeader}
        <Divider />
        {primaryEntries.map(renderMenuItem)}
        <Divider />
        {donationEntries.map(renderMenuItem)}
        <Divider />
        {sessionEntries.map(renderMenuItem)}
      </Menu>
    </>
  );
}

export default function NavbarAuth(props: NavbarAuthProps) {
  return (
    <MuiIslandProvider>
      <NavbarAuthInner {...props} />
    </MuiIslandProvider>
  );
}
