import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import { Avatar, Button, Chip, Stack } from "@mui/material";

function NavbarAuthInner() {
  const { user, ready, isLoggedIn, login, logout } = useAuth();

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

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Chip
        avatar={<Avatar src={user.avatarUrl} alt={user.name} />}
        label={user.handle}
        size="small"
      />
      <Button size="small" color="inherit" onClick={() => logout({ returnTo: "/" })}>
        Sair
      </Button>
    </Stack>
  );
}

export default function NavbarAuth() {
  return (
    <MuiIslandProvider>
      <NavbarAuthInner />
    </MuiIslandProvider>
  );
}
