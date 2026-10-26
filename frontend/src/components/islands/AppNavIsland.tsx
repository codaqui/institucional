import { useEffect, type ReactNode } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BusinessIcon from "@mui/icons-material/Business";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import EventIcon from "@mui/icons-material/Event";
import HomeIcon from "@mui/icons-material/Home";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HubIcon from "@mui/icons-material/Hub";
import LogoutIcon from "@mui/icons-material/Logout";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TokenIcon from "@mui/icons-material/Token";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";

/**
 * Navegação do app (sidebar) — port vertical do AdminNavbar do Docusaurus
 * (src/components/AdminNavbar). Espelha a visibilidade por papel: item sem
 * `roles` é visível para qualquer membro logado; admin vê tudo; os demais
 * precisam de ao menos um papel listado (igual ao `canSee` original).
 */

export interface AppNavIslandProps {
  /** Rota atual (Astro.url.pathname) — define o item ativo por prefixo. */
  currentPath: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles?: readonly string[];
}

const GESTAO_ITEMS: readonly NavItem[] = [
  { label: "Membros", href: "/admin", icon: <DashboardIcon />, roles: ["admin"] },
  { label: "Reembolsos", href: "/admin/reembolsos", icon: <ReceiptLongIcon />, roles: ["admin", "finance-analyzer"] },
  { label: "Fornecedores", href: "/admin/fornecedores", icon: <StorefrontIcon />, roles: ["admin", "finance-analyzer"] },
  { label: "Pagamentos", href: "/admin/pagamentos", icon: <PaymentIcon />, roles: ["admin", "finance-analyzer"] },
  { label: "Recebimentos", href: "/admin/recebimentos", icon: <CallReceivedIcon />, roles: ["admin", "finance-analyzer"] },
  { label: "Empresas", href: "/admin/empresas", icon: <BusinessIcon />, roles: ["admin"] },
  { label: "Sorteios", href: "/admin/sorteios", icon: <EmojiEventsIcon />, roles: ["admin"] },
  { label: "VirtualCoins", href: "/admin/carteiras", icon: <TokenIcon />, roles: ["admin"] },
  { label: "Carteira", href: "/admin/lancamento", icon: <AccountBalanceWalletIcon />, roles: ["admin", "finance-analyzer"] },
  { label: "E-mails", href: "/admin/emails", icon: <EmailIcon />, roles: ["admin"] },
];

const EVENTO_ITEMS: readonly NavItem[] = [
  { label: "Visão geral", href: "/admin/eventos", icon: <HubIcon />, roles: ["event_organizer", "event_host"] },
  { label: "Overrides & externos", href: "/admin/overrides", icon: <EditCalendarIcon />, roles: ["event_organizer"] },
  { label: "Check-in", href: "/admin/eventos-checkin", icon: <HowToRegIcon />, roles: ["event_organizer", "event_checker", "event_host"] },
];

const CONTA_ITEMS: readonly NavItem[] = [
  { label: "Início", href: "/membro", icon: <HomeIcon /> },
  { label: "Editar perfil", href: "/membro/editar", icon: <EditIcon /> },
];

/** Hubs ativam só no match exato — senão /admin/eventos ativaria "Membros". */
const HUB_PATHS = new Set(["/admin", "/membro"]);

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  "finance-analyzer": "Financeiro",
  event_organizer: "Organizador",
  event_host: "Host",
  event_checker: "Checker",
};

function isItemActive(currentPath: string, href: string): boolean {
  if (currentPath === href) return true;
  if (HUB_PATHS.has(href)) return false;
  return currentPath.startsWith(`${href}/`);
}

function NavGroupLabel({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 2,
        pt: 1.5,
        pb: 0.5,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontWeight: 700,
        color: "text.secondary",
      }}
    >
      {icon}
      {children}
    </Typography>
  );
}

function NavLink({
  item,
  currentPath,
}: {
  item: NavItem;
  currentPath: string;
}) {
  const active = isItemActive(currentPath, item.href);
  return (
    <ListItemButton
      component="a"
      href={item.href}
      selected={active}
      aria-current={active ? "page" : undefined}
      sx={{ mx: 1, mb: 0.25, borderRadius: 1 }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{ primary: { variant: "body2" } }}
      />
    </ListItemButton>
  );
}

export function AppNavContent({ currentPath }: AppNavIslandProps) {
  const { user, ready, isLoggedIn, isAdmin, logout } = useAuth();

  useEffect(() => {
    if (ready && !isLoggedIn) window.location.replace("/");
  }, [ready, isLoggedIn]);

  if (!ready) {
    return (
      <div role="status" className="flex flex-col gap-2 p-3">
        <span className="cq-visually-hidden">Carregando navegação…</span>
        <span className="h-12 animate-pulse rounded-md bg-sunken" />
        <span className="h-12 animate-pulse rounded-md bg-sunken" />
        <span className="h-24 animate-pulse rounded-md bg-sunken" />
      </div>
    );
  }

  if (!isLoggedIn || !user) return null; // guard disparou redirect

  const userRoles = user.roles;
  const canSee = (item: NavItem) =>
    !item.roles || isAdmin || item.roles.some((role) => userRoles.includes(role));

  const gestaoItems = GESTAO_ITEMS.filter(canSee);
  const eventoItems = EVENTO_ITEMS.filter(canSee);
  const roleChips = userRoles.filter((role) => role !== "membro");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
        <Avatar
          src={user.avatarUrl}
          alt={`Avatar de ${user.name}`}
          sx={{ width: 40, height: 40 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            @{user.handle}
          </Typography>
        </Box>
      </Box>
      {roleChips.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            px: 2,
            pb: 1.5,
          }}
        >
          {roleChips.map((role) => (
            <Chip
              key={role}
              size="small"
              variant="outlined"
              label={ROLE_LABELS[role] ?? role}
            />
          ))}
        </Box>
      )}
      <Divider />
      <Box
        component="nav"
        aria-label="Navegação do painel"
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 1 }}
      >
        {(gestaoItems.length > 0 || eventoItems.length > 0) && (
          <>
            <NavGroupLabel>Gestão</NavGroupLabel>
            {gestaoItems.length > 0 && (
              <List dense sx={{ py: 0 }}>
                {gestaoItems.map((item) => (
                  <NavLink key={item.href} item={item} currentPath={currentPath} />
                ))}
              </List>
            )}
            {eventoItems.length > 0 && (
              <>
                <NavGroupLabel icon={<EventIcon fontSize="inherit" />}>
                  Eventos
                </NavGroupLabel>
                <List dense sx={{ py: 0 }}>
                  {eventoItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      currentPath={currentPath}
                    />
                  ))}
                </List>
              </>
            )}
          </>
        )}
        <NavGroupLabel>Conta</NavGroupLabel>
        <List dense sx={{ py: 0 }}>
          {CONTA_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} currentPath={currentPath} />
          ))}
        </List>
      </Box>
      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={() => logout()}
        >
          Sair
        </Button>
      </Box>
    </Box>
  );
}

export default function AppNavIsland(props: AppNavIslandProps) {
  return (
    <MuiIslandProvider>
      <AppNavContent {...props} />
    </MuiIslandProvider>
  );
}
