import React, { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BusinessIcon from "@mui/icons-material/Business";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import EmailIcon from "@mui/icons-material/Email";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import EventIcon from "@mui/icons-material/Event";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HubIcon from "@mui/icons-material/Hub";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TokenIcon from "@mui/icons-material/Token";
import { useAuth } from "../../hooks/useAuth";

interface AdminNavbarProps {
  /** Highlight the active page button (pass the current route, e.g. "/admin/carteiras") */
  active?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /**
   * Roles que podem ver a entrada. Admin sempre vê tudo.
   * Omitir = visível para qualquer usuário com acesso ao painel.
   */
  roles?: string[];
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Membros", href: "/admin", icon: <DashboardIcon /> },
  { label: "Reembolsos", href: "/admin/reembolsos", icon: <ReceiptLongIcon /> },
  { label: "Fornecedores", href: "/admin/fornecedores", icon: <StorefrontIcon /> },
  { label: "Pagamentos", href: "/admin/pagamentos", icon: <PaymentIcon /> },
  { label: "Recebimentos", href: "/admin/recebimentos", icon: <CallReceivedIcon /> },
  { label: "Empresas", href: "/admin/empresas", icon: <BusinessIcon /> },
  { label: "Sorteios", href: "/admin/sorteios", icon: <EmojiEventsIcon /> },
  { label: "VirtualCoins", href: "/admin/carteiras", icon: <TokenIcon /> },
  { label: "Carteira", href: "/admin/lancamento", icon: <AccountBalanceWalletIcon /> },
  {
    label: "Eventos",
    icon: <EventIcon />,
    items: [
      { label: "Visão geral", href: "/admin/eventos", icon: <HubIcon />, roles: ["event_organizer"] },
      { label: "Overrides & externos", href: "/admin/overrides", icon: <EditCalendarIcon />, roles: ["event_organizer"] },
      { label: "Check-in", href: "/admin/eventos-checkin", icon: <HowToRegIcon />, roles: ["event_organizer", "event_checker"] },
    ],
  },
  { label: "E-mails", href: "/admin/emails", icon: <EmailIcon />, roles: ["admin"] },
] as const;

export default function AdminNavbar({ active }: Readonly<AdminNavbarProps>): React.JSX.Element {
  const { user, isAdmin } = useAuth();
  const userRoles = user?.roles ?? [];

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const openGroupRef = useRef<NavGroup | null>(null);

  const canSee = (item: NavItem): boolean => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.some((role) => userRoles.includes(role));
  };

  const visibleEntries = NAV_ENTRIES.map((entry) => {
    if (!isGroup(entry)) return canSee(entry) ? entry : null;
    const items = entry.items.filter(canSee);
    return items.length > 0 ? { ...entry, items } : null;
  }).filter((entry): entry is NavEntry => entry !== null);

  const isItemActive = (href: string) =>
    active === href || (href === "/admin" && active === "/admin");

  const openMenu = (group: NavGroup) => (event: React.MouseEvent<HTMLElement>) => {
    openGroupRef.current = group;
    setMenuAnchor(event.currentTarget);
  };

  const closeMenu = () => setMenuAnchor(null);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        flexWrap: "wrap",
        p: 1.5,
        mb: 3,
        borderRadius: 2,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ mr: 1, textTransform: "uppercase", letterSpacing: 1 }}
      >
        Admin
      </Typography>
      {visibleEntries.map((entry) => {
        if (isGroup(entry)) {
          const groupActive = entry.items.some((item) => isItemActive(item.href));
          return (
            <Button
              key={entry.label}
              variant={groupActive ? "contained" : "outlined"}
              size="small"
              startIcon={entry.icon}
              endIcon={<ExpandMoreIcon />}
              color={groupActive ? "primary" : "inherit"}
              onClick={openMenu(entry)}
              aria-haspopup="menu"
              aria-label={`Abrir submenu ${entry.label}`}
              sx={{ textTransform: "none" }}
            >
              {entry.label}
            </Button>
          );
        }
        const isActive = isItemActive(entry.href);
        return (
          <Button
            key={entry.href}
            variant={isActive ? "contained" : "outlined"}
            size="small"
            startIcon={entry.icon}
            href={entry.href}
            color={isActive ? "primary" : "inherit"}
            sx={{ textTransform: "none" }}
          >
            {entry.label}
          </Button>
        );
      })}

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        {(openGroupRef.current?.items ?? []).map((item) => (
          <MenuItem
            key={item.href}
            component="a"
            href={item.href}
            onClick={closeMenu}
            selected={isItemActive(item.href)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
