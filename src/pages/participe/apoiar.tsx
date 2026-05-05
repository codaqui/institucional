import React from "react";
import Layout from "@theme/Layout";
import Container from "@mui/material/Container";
import PageHero from "../../components/PageHero";
import DonationFlow from "../../components/DonationFlow";

export default function ApoiarPage(): React.JSX.Element {
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
        <DonationFlow
          subtitle="Selecione a carteira à esquerda, o valor e a frequência. Doações anônimas aceitas até R$ 100 (única ou recorrente)."
        />
      </Container>
    </Layout>
  );
}
