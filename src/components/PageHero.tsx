import React from "react";
import { Container, Box, Typography } from "@mui/material";

interface PageHeroProps {
  /** Eyebrow label acima do título — ex: "Portal de Transparência" */
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Slot para botões de ação ou chips abaixo do subtítulo */
  readonly children?: React.ReactNode;
  /** Alinhamento do conteúdo — padrão "center" */
  readonly align?: "center" | "left";
}

/**
 * Hero institucional padrão Codaqui.
 *
 * Design: fundo escuro sóbrio com ruído sutil e borda inferior de acento verde.
 * Sem emojis, sem gradientes coloridos — visual formal e profissional.
 * Funciona em light e dark mode (fundo sempre escuro por ser uma seção de destaque).
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  align = "center",
}: PageHeroProps): React.JSX.Element {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        bgcolor: "#111827",          // slate-900 — funciona em qualquer mode
        color: "common.white",
        py: { xs: 7, md: 11 },
        textAlign: align,
        overflow: "hidden",

        // Efeito de grade fina (noise) — puro CSS, sem imagens
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 60% 40%, rgba(34,197,94,0.08) 0%, transparent 55%)," +
            "radial-gradient(circle at 20% 80%, rgba(14,165,233,0.06) 0%, transparent 50%)",
          pointerEvents: "none",
        },

        // Linha de acento na parte inferior
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: align === "center" ? "50%" : "0",
          transform: align === "center" ? "translateX(-50%)" : "none",
          width: align === "center" ? "80px" : "120px",
          height: "3px",
          bgcolor: "primary.main",
          borderRadius: "2px 2px 0 0",
        },
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          position: "relative",
          zIndex: 1,
          ...(align === "left" && { textAlign: "left" }),
        }}
      >
        {eyebrow && (
          <Typography
            component="p"
            variant="overline"
            sx={{
              color: "primary.light",
              letterSpacing: "0.15em",
              fontWeight: 600,
              mb: 1.5,
              display: "block",
            }}
          >
            {eyebrow}
          </Typography>
        )}

        <Typography
          variant="h2"
          fontWeight={800}
          gutterBottom
          color="common.white"
          sx={{
            lineHeight: 1.15,
            fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="body1"
            sx={{
              color: "rgba(255,255,255,0.65)",
              maxWidth: 580,
              mx: align === "center" ? "auto" : 0,
              mt: 0.5,
              lineHeight: 1.7,
              fontSize: { xs: "1rem", md: "1.1rem" },
            }}
          >
            {subtitle}
          </Typography>
        )}

        {children && (
          <Box sx={{ mt: 3 }}>{children}</Box>
        )}
      </Container>
    </Box>
  );
}
