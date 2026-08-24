import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import { useLocation, useHistory } from "@docusaurus/router";
import PageHero from "../../components/PageHero";
import DonationFlow from "../../components/DonationFlow";
import CompanyDonationSection from "../../components/CompanyDonationSection";

const MODES = [
  { value: "pf" as const, label: "Pessoa Física", Icon: PersonIcon },
  { value: "pj" as const, label: "Pessoa Jurídica / Empresa", Icon: BusinessIcon },
];

function getModeFromSearch(search: string): "pf" | "pj" {
  return new URLSearchParams(search).get("modo") === "empresa" ? "pj" : "pf";
}

export default function ApoiarPage(): React.JSX.Element {
  const location = useLocation();
  const history = useHistory();
  const [mode, setMode] = useState<"pf" | "pj">(() => getModeFromSearch(location.search));

  // Mantém estado sincronizado com a URL em caso de navegação (voltar/avançar).
  useEffect(() => {
    const next = getModeFromSearch(location.search);
    setMode((current) => (current !== next ? next : current));
  }, [location.search]);

  const handleModeChange = (next: "pf" | "pj") => {
    setMode(next);
    const params = new URLSearchParams(location.search);
    if (next === "pj") {
      params.set("modo", "empresa");
    } else {
      params.delete("modo");
    }
    history.replace({ search: params.toString() });
  };

  return (
    <Layout
      title="Apoiar a Codaqui"
      description="Doe diretamente para a Codaqui ou para uma comunidade parceira. 100% transparente."
    >
      <PageHero
        eyebrow="Quero Apoiar"
        title="Apoie a Codaqui"
        subtitle="Toda contribuição financia tecnologia acessível. Veja em tempo real para onde vai cada real."
      />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Box
          sx={{
            mb: { xs: 3, md: 4 },
            display: "flex",
            justifyContent: "center",
          }}
          role="tablist"
          aria-label="Escolha o tipo de apoio"
        >
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => {
              if (v) handleModeChange(v as "pf" | "pj");
            }}
            sx={{
              bgcolor: "action.hover",
              p: 0.5,
              borderRadius: 3,
              width: { xs: "100%", sm: "auto" },
              "& .MuiToggleButtonGroup-grouped": {
                flex: { xs: 1, sm: "0 0 auto" },
                px: { xs: 2, md: 3 },
                py: 1.2,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                gap: 1,
                border: "none",
                color: "text.secondary",
                transition: "all 0.2s ease",
                "&.Mui-selected": {
                  bgcolor: "background.paper",
                  color: "text.primary",
                  boxShadow: 1,
                },
              },
            }}
          >
            {MODES.map((m) => {
              const Icon = m.Icon;
              return (
                <ToggleButton
                  key={m.value}
                  value={m.value}
                  role="tab"
                  aria-selected={mode === m.value}
                >
                  <Icon fontSize="small" />
                  {m.label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: mode === "pf" ? "block" : "none" }} role="tabpanel">
          <DonationFlow
            subtitle="Selecione a carteira à esquerda, o valor e a frequência. Doações anônimas aceitas até R$ 100 (única ou recorrente)."
            onCompanyClick={() => handleModeChange("pj")}
          />
        </Box>
        <Box sx={{ display: mode === "pj" ? "block" : "none" }} role="tabpanel">
          <CompanyDonationSection onBack={() => handleModeChange("pf")} />
          <Divider sx={{ my: 4 }} />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Já assinou? Gerencie sua empresa e colaboradores no seu perfil.
            </Typography>
            <Button
              variant="outlined"
              color="success"
              startIcon={<BusinessIcon />}
              href="/membros/empresa"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Gerenciar minha empresa
            </Button>
          </Box>
        </Box>
      </Container>
    </Layout>
  );
}
