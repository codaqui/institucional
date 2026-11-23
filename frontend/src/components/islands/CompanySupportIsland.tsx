import { useState } from "react";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CompanyDonationIsland from "./CompanyDonationIsland";
import CompanyOneTimeDonationIsland from "./CompanyOneTimeDonationIsland";

type CompanySupportMode = "subscription" | "once";

function modeFromLocation(): CompanySupportMode {
  if (globalThis.window === undefined) return "subscription";
  return new URLSearchParams(globalThis.location.search).get("apoio") === "unica"
    ? "once"
    : "subscription";
}

export default function CompanySupportIsland() {
  const [mode, setMode] = useState<CompanySupportMode>(modeFromLocation);

  const changeMode = (nextMode: CompanySupportMode) => {
    setMode(nextMode);
    const params = new URLSearchParams(globalThis.location.search);
    if (nextMode === "once") params.set("apoio", "unica");
    else params.delete("apoio");
    const search = params.toString();
    globalThis.history.replaceState(null, "", `${globalThis.location.pathname}${search ? `?${search}` : ""}`);
  };

  return (
    <Box>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, value: CompanySupportMode | null) => {
          if (value) changeMode(value);
        }}
        aria-label="Tipo de apoio da empresa"
        sx={{ mb: 3, flexWrap: "wrap" }}
      >
        <ToggleButton value="once" sx={{ textTransform: "none", fontWeight: 700 }}>
          Doação única
        </ToggleButton>
        <ToggleButton value="subscription" sx={{ textTransform: "none", fontWeight: 700 }}>
          Assinatura mensal
        </ToggleButton>
      </ToggleButtonGroup>
      {mode === "once" ? <CompanyOneTimeDonationIsland /> : <CompanyDonationIsland />}
    </Box>
  );
}
