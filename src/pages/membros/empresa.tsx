import React, { useEffect } from "react";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import { useHistory } from "@docusaurus/router";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import BusinessIcon from "@mui/icons-material/Business";
import MyCompanySection from "../../components/MyCompanySection";
import { useAuth } from "../../hooks/useAuth";

export default function EmpresaPage(): React.JSX.Element {
  const { isLoggedIn, ready } = useAuth();
  const history = useHistory();

  useEffect(() => {
    if (ready && !isLoggedIn) {
      history.replace("/");
    }
  }, [ready, isLoggedIn, history]);

  if (!ready || !isLoggedIn) return null;

  return (
    <Layout title="Minha Empresa" description="Gerencie a empresa vinculada ao seu perfil Codaqui">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
          <BusinessIcon sx={{ fontSize: 36, color: "success.main" }} />
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Minha Empresa
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie a empresa vinculada ao seu perfil, colaboradores e carteira CLUB Business.
            </Typography>
          </Box>
        </Box>

        <MyCompanySection />
      </Container>
    </Layout>
  );
}
