import React, { useState } from "react";
import Layout from "@theme/Layout";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import PageHero from "../../components/PageHero";
import DonationFlow from "../../components/DonationFlow";
import CompanyDonationSection from "../../components/CompanyDonationSection";

export default function ApoiarPage(): React.JSX.Element {
  const [mode, setMode] = useState<"pf" | "pj">("pf");

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
        <Box sx={{ display: mode === "pf" ? "block" : "none" }}>
          <DonationFlow
            subtitle="Selecione a carteira à esquerda, o valor e a frequência. Doações anônimas aceitas até R$ 100 (única ou recorrente)."
            onCompanyClick={() => setMode("pj")}
          />
        </Box>
        <Box sx={{ display: mode === "pj" ? "block" : "none" }}>
          <CompanyDonationSection onBack={() => setMode("pf")} />
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
