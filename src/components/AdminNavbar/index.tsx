import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BusinessIcon from "@mui/icons-material/Business";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TokenIcon from "@mui/icons-material/Token";

interface AdminNavbarProps {
  /** Highlight the active page button (pass the current route, e.g. "/admin/carteiras") */
  active?: string;
}

const NAV_ITEMS = [
  { label: "Membros", href: "/admin", icon: <DashboardIcon /> },
  { label: "Reembolsos", href: "/admin/reembolsos", icon: <ReceiptLongIcon /> },
  { label: "Fornecedores", href: "/admin/fornecedores", icon: <StorefrontIcon /> },
  { label: "Pagamentos", href: "/admin/pagamentos", icon: <PaymentIcon /> },
  { label: "Recebimentos", href: "/admin/recebimentos", icon: <CallReceivedIcon /> },
  { label: "Empresas", href: "/admin/empresas", icon: <BusinessIcon /> },
  { label: "Sorteios", href: "/admin/sorteios", icon: <EmojiEventsIcon /> },
  { label: "VirtualCoins", href: "/admin/carteiras", icon: <TokenIcon /> },
  { label: "Carteira", href: "/admin/lancamento", icon: <AccountBalanceWalletIcon /> },
] as const;

export default function AdminNavbar({ active }: Readonly<AdminNavbarProps>): React.JSX.Element {
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
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.href || (item.href === "/admin" && active === "/admin");
        return (
          <Button
            key={item.href}
            variant={isActive ? "contained" : "outlined"}
            size="small"
            startIcon={item.icon}
            href={item.href}
            color={isActive ? "primary" : "inherit"}
            sx={{ textTransform: "none" }}
          >
            {item.label}
          </Button>
        );
      })}
    </Box>
  );
}
