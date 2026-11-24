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
    const query = search ? `?${search}` : "";
    globalThis.history.replaceState(null, "", `${globalThis.location.pathname}${query}`);
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
        size="small"
        sx={{
          mb: 3,
          flexWrap: "wrap",
          "& .MuiToggleButton-root": {
            px: 2.5,
            fontWeight: 600,
            textTransform: "none",
            color: "text.primary",
            "&.Mui-selected": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": { bgcolor: "primary.dark" },
            },
          },
        }}
      >
        <ToggleButton value="once">Doação única</ToggleButton>
        <ToggleButton value="subscription">Assinatura mensal</ToggleButton>
      </ToggleButtonGroup>
      {mode === "once" ? <CompanyOneTimeDonationIsland /> : <CompanyDonationIsland />}
    </Box>
  );
}
