import { useEffect, useState, type ReactNode } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import ScheduleIcon from "@mui/icons-material/Schedule";
import HomeIcon from "@mui/icons-material/Home";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HubIcon from "@mui/icons-material/Hub";
import LogoutIcon from "@mui/icons-material/Logout";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SettingsIcon from "@mui/icons-material/Settings";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TokenIcon from "@mui/icons-material/Token";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import {
  formatDesignationLabel,
  useMyDesignations,
  type MyDesignation,
} from "../../lib/use-designations";

/**
 * Navegação do app (sidebar): item sem restrição é visível para qualquer
 * membro logado; admin vê tudo; os demais precisam de role ou designation.
 */

export interface AppNavIslandProps {
  /** Rota atual (Astro.url.pathname) — define o item ativo por prefixo. */
  readonly currentPath: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles?: readonly string[];
  designations?: readonly {
    targetType: MyDesignation["targetType"];
    designation?: MyDesignation["designation"];
  }[];
}

interface NavGroup {
  id: string;
  label: string;
  icon?: ReactNode;
  items: readonly NavItem[];
}

const MANAGEMENT_GROUPS: readonly NavGroup[] = [
  {
    id: "gestao",
    label: "Gestão",
    items: [
      { label: "Membros", href: "/admin", icon: <DashboardIcon />, roles: ["admin"] },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    items: [
      {
        label: "Horas",
        href: "/admin/horas",
        icon: <ScheduleIcon />,
        roles: ["admin", "finance-analyzer"],
      },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro (R$)",
    items: [
      { label: "Reembolsos", href: "/admin/reembolsos", icon: <ReceiptLongIcon />, roles: ["admin", "finance-analyzer"] },
      { label: "Fornecedores", href: "/admin/fornecedores", icon: <StorefrontIcon />, roles: ["admin", "finance-analyzer"] },
      { label: "Pagamentos", href: "/admin/pagamentos", icon: <PaymentIcon />, roles: ["admin", "finance-analyzer"] },
      { label: "Recebimentos", href: "/admin/recebimentos", icon: <CallReceivedIcon />, roles: ["admin", "finance-analyzer"] },
      { label: "Carteira", href: "/admin/lancamento", icon: <AccountBalanceWalletIcon />, roles: ["admin", "finance-analyzer"] },
    ],
  },
  {
    id: "clube",
    label: "Clube & SortCoins",
    items: [
      { label: "Sorteios", href: "/admin/sorteios", icon: <EmojiEventsIcon />, roles: ["admin"] },
      { label: "VirtualCoins", href: "/admin/carteiras", icon: <TokenIcon />, roles: ["admin"] },
    ],
  },
  {
    id: "empresas",
    label: "Empresas",
    items: [
      { label: "Empresas", href: "/admin/empresas", icon: <BusinessIcon />, roles: ["admin"] },
    ],
  },
  {
    id: "eventos",
    label: "Eventos",
    icon: <EventIcon fontSize="inherit" />,
    items: [
      { label: "Visão geral", href: "/admin/eventos", icon: <HubIcon />, roles: ["event_organizer", "event_host"] },
      { label: "Overrides & externos", href: "/admin/overrides", icon: <EditCalendarIcon />, roles: ["event_organizer"] },
      { label: "Check-in", href: "/admin/eventos-checkin", icon: <HowToRegIcon />, roles: ["event_organizer", "event_checker", "event_host"] },
    ],
  },
  {
    id: "governanca",
    label: "Governança",
    items: [
      {
        label: "Minha comunidade",
        href: "/admin/comunidades",
        icon: <BusinessIcon />,
        designations: [{ targetType: "community", designation: "responsible" }],
      },
      {
        label: "Diretorias",
        href: "/admin/diretorias",
        icon: <HubIcon />,
        designations: [{ targetType: "directorate", designation: "director" }],
      },
      {
        label: "Assembleias",
        href: "/admin/assembleias",
        icon: <HubIcon />,
        roles: ["diretor"],
      },
      {
        label: "Entidades",
        href: "/admin/entidades",
        icon: <BusinessIcon />,
        designations: [{ targetType: "directorate", designation: "director" }],
      },
      {
        label: "Projetos de extensão",
        href: "/admin/projetos",
        icon: <HubIcon />,
        designations: [{ targetType: "directorate", designation: "director" }],
      },
      { label: "Configurações", href: "/admin/configuracoes", icon: <SettingsIcon />, roles: ["admin"] },
    ],
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    items: [
      { label: "E-mails", href: "/admin/emails", icon: <EmailIcon />, roles: ["admin"] },
    ],
  },
];

const CONTA_ITEMS: readonly NavItem[] = [
  { label: "Início", href: "/membro", icon: <HomeIcon /> },
  { label: "Minhas horas", href: "/membro/horas", icon: <ScheduleIcon /> },
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
  readonly icon?: ReactNode;
  readonly children: ReactNode;
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
  readonly item: NavItem;
  readonly currentPath: string;
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

function CollapsibleNavGroup({
  group,
  currentPath,
  expanded,
  onToggle,
}: {
  readonly group: NavGroup;
  readonly currentPath: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const contentId = `nav-group-${group.id}`;
  return (
    <>
      <ListItemButton
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        sx={{ px: 2, py: 0.5 }}
      >
        <ListItemText
          primary={
            <NavGroupLabel icon={group.icon}>{group.label}</NavGroupLabel>
          }
        />
        <ExpandMoreIcon
          sx={{
            color: "text.secondary",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      </ListItemButton>
      <Collapse in={expanded} timeout={150} unmountOnExit>
        <List dense id={contentId} sx={{ py: 0 }}>
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} currentPath={currentPath} />
          ))}
        </List>
      </Collapse>
    </>
  );
}

export function AppNavContent({ currentPath }: AppNavIslandProps) {
  const { user, ready, isLoggedIn, isAdmin, logout } = useAuth();
  const { data: myDesignations } = useMyDesignations();
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (ready && !isLoggedIn) window.location.replace("/");
  }, [ready, isLoggedIn]);

  if (!ready) {
    return (
      <output className="flex flex-col gap-2 p-3">
        <span className="cq-visually-hidden">Carregando navegação…</span>
        <span className="h-12 animate-pulse rounded-md bg-sunken" />
        <span className="h-12 animate-pulse rounded-md bg-sunken" />
        <span className="h-24 animate-pulse rounded-md bg-sunken" />
      </output>
    );
  }

  if (!isLoggedIn || !user) return null; // guard disparou redirect

  const userRoles = user.roles;
  const canSee = (item: NavItem) => {
    const roleMatch =
      item.roles?.some((role) => userRoles.includes(role)) ?? false;
    const designationMatch =
      item.designations?.some((required) =>
        myDesignations.some(
          (designation) =>
            designation.targetType === required.targetType &&
            (!required.designation ||
              designation.designation === required.designation),
        ),
      ) ?? false;
    return (
      isAdmin ||
      (!item.roles && !item.designations) ||
      roleMatch ||
      designationMatch
    );
  };

  const roleChips = userRoles.filter((role) => role !== "membro");
  const normalizedSearch = search
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
  const visibleGroups = MANAGEMENT_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        canSee(item) &&
        (!normalizedSearch ||
          item.label
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLocaleLowerCase("pt-BR")
            .includes(normalizedSearch)),
    ),
  })).filter((group) => group.items.length > 0);

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
      {(roleChips.length > 0 || myDesignations.length > 0) && (
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
          {myDesignations.map((designation) => (
            <Chip
              key={designation.id}
              size="small"
              variant="outlined"
              label={formatDesignationLabel(designation)}
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
        {visibleGroups.length > 0 && (
          <TextField
            fullWidth
            size="small"
            label="Buscar no painel"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ px: 1.5, pb: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        {visibleGroups.map((group) => (
          <CollapsibleNavGroup
            key={group.id}
            group={group}
            currentPath={currentPath}
            expanded={Boolean(normalizedSearch) || !collapsedGroups[group.id]}
            onToggle={() =>
              setCollapsedGroups((current) => ({
                ...current,
                [group.id]: !current[group.id],
              }))
            }
          />
        ))}
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

export default function AppNavIsland(props: Readonly<AppNavIslandProps>) {
  return (
    <MuiIslandProvider>
      <AppNavContent {...props} />
    </MuiIslandProvider>
  );
}
