import { Alert } from "@mui/material";
import MuiIslandProvider from "../MuiIslandProvider";
import MenteeSessionIsland from "./MenteeSessionIsland";

export default function MenteeSessionRouteIsland() {
  const queryToken = new URLSearchParams(window.location.search).get("token");
  const pathToken = window.location.pathname.split("/").filter(Boolean).at(-1);
  const token = queryToken ?? (pathToken && pathToken !== "sessao" && pathToken !== "mentoria" ? pathToken : null);
  if (!token) return <MuiIslandProvider><Alert severity="error">Token da sessão não informado.</Alert></MuiIslandProvider>;
  return <MenteeSessionIsland token={token} />;
}
