import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { CommunitySiteConfig } from "../../types";

interface CommunityHeroProps {
  readonly community: CommunitySiteConfig;
}

function useScrollReveal() {
  const [isVisible, setIsVisible] = useState(false);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    setIsVisible(true);

    let rafId = 0;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        if (Math.abs(scrollY - lastScrollY) > 0.5) {
          lastScrollY = scrollY;
          setOffsetY(scrollY * 0.18);
        }
        rafId = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return { isVisible, offsetY };
}

function HeroBackground({
  isDark,
  primary,
  primaryDark,
  imagePosition,
}: {
  readonly isDark: boolean;
  readonly primary: string;
  readonly primaryDark: string;
  readonly imagePosition: "left" | "right";
}) {
  const side = imagePosition === "right" ? "85%" : "15%";
  const gradientDark = `radial-gradient(ellipse 80% 70% at ${side} 50%, ${primaryDark}30 0%, transparent 60%), linear-gradient(135deg, ${primaryDark}15 0%, #050a08 55%)`;
  const gradientLight = `radial-gradient(ellipse 80% 70% at ${side} 50%, ${primary}18 0%, transparent 60%), linear-gradient(135deg, #ffffff 0%, #e8f5ed 55%)`;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        background: isDark ? gradientDark : gradientLight,
        zIndex: 0,
      }}
    />
  );
}

function HeroImage({
  visual,
  isDark,
  isVisible,
  offsetY,
  primary,
  primaryDark,
  primaryLight,
  blendColor,
  imagePosition,
}: {
  readonly visual: NonNullable<CommunitySiteConfig["heroVisual"]>;
  readonly isDark: boolean;
  readonly isVisible: boolean;
  readonly offsetY: number;
  readonly primary: string;
  readonly primaryDark: string;
  readonly primaryLight: string;
  readonly blendColor: string;
  readonly imagePosition: "left" | "right";
}) {
  const isRight = imagePosition === "right";
  const horizontalPosition = isRight ? "right" : "left";
  const hiddenTranslateX = isRight ? "60px" : "-60px";
  const transform = isVisible
    ? `translateY(${offsetY}px) translateX(0)`
    : `translateY(40px) translateX(${hiddenTranslateX})`;

  return (
    <Box
      sx={{
        position: "absolute",
        [horizontalPosition]: { xs: "auto", sm: "-8%", md: "-2%", lg: "5%", xl: "10%" },
        left: { xs: "0%", sm: "auto" },
        bottom: 0,
        top: 0,
        width: { xs: "100%", sm: "65%", md: "50%", lg: "40%", xl: "35%" },
        height: "100%",
        opacity: isVisible ? { xs: 0.22, sm: 1 } : 0,
        transform,
        transition: "opacity 1s cubic-bezier(0.22, 1, 0.36, 1), transform 1s cubic-bezier(0.22, 1, 0.36, 1)",
        zIndex: 1,
        pointerEvents: "none",
        mixBlendMode: isDark ? "screen" : "multiply",
        maskImage: { sm: "linear-gradient(to top, black 70%, transparent 100%)" },
        WebkitMaskImage: { sm: "linear-gradient(to top, black 70%, transparent 100%)" },
      }}
    >
      <Box
        component="img"
        src={visual.imageSrc}
        alt={visual.imageAlt}
        sx={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: { xs: "center center", sm: "center bottom" },
          filter: isDark
            ? `grayscale(100%) contrast(1.1) brightness(0.85) drop-shadow(0 0 60px ${blendColor}55)`
            : "grayscale(100%) contrast(0.9) brightness(1.05)",
          transform: isRight ? "scaleX(1)" : "scaleX(-1)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: isDark
            ? `linear-gradient(to top, ${primaryDark}ee 0%, ${blendColor}99 45%, transparent 85%)`
            : `linear-gradient(to top, ${blendColor}cc 0%, ${primaryLight}99 45%, transparent 85%)`,
          mixBlendMode: "color",
          opacity: 0.92,
        }}
      />
    </Box>
  );
}

function HeroGrid({
  isDark,
  primary,
  primaryLight,
  offsetY,
}: {
  readonly isDark: boolean;
  readonly primary: string;
  readonly primaryLight: string;
  readonly offsetY: number;
}) {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        opacity: 0.04,
        backgroundImage: isDark
          ? `linear-gradient(${primaryLight} 1px, transparent 1px), linear-gradient(90deg, ${primaryLight} 1px, transparent 1px)`
          : `linear-gradient(${primary} 1px, transparent 1px), linear-gradient(90deg, ${primary} 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        zIndex: 0,
        transform: `translateY(${offsetY * 0.3}px)`,
      }}
    />
  );
}

function AnimatedBox({
  children,
  isVisible,
  delay = 0,
}: {
  readonly children: React.ReactNode;
  readonly isVisible: boolean;
  readonly delay?: number;
}) {
  return (
    <Box
      sx={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
        transition: `all 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
      }}
    >
      {children}
    </Box>
  );
}

function HeroCtas({
  community,
  isDark,
  primary,
  primaryDark,
}: {
  readonly community: CommunitySiteConfig;
  readonly isDark: boolean;
  readonly primary: string;
  readonly primaryDark: string;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Button
        component={Link}
        to={community.hero.ctaPrimary.to}
        variant="contained"
        size="large"
        startIcon={<VolunteerActivismIcon />}
        sx={{
          bgcolor: primary,
          color: "#fff",
          fontWeight: 700,
          textTransform: "none",
          px: 3.5,
          py: 1.2,
          borderRadius: 2.5,
          boxShadow: `0 10px 30px ${primary}44`,
          "&:hover": {
            bgcolor: primaryDark,
            boxShadow: `0 14px 40px ${primary}66`,
            transform: "translateY(-2px)",
          },
          transition: "all 0.25s ease",
        }}
      >
        {community.hero.ctaPrimary.label}
      </Button>

      {community.hero.ctaSecondary && (
        <Button
          component="a"
          href={community.hero.ctaSecondary.href}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="large"
          endIcon={<OpenInNewIcon />}
          sx={{
            color: isDark ? "#fff" : primaryDark,
            borderColor: isDark ? "rgba(255,255,255,0.35)" : `${primary}55`,
            fontWeight: 600,
            textTransform: "none",
            px: 3.5,
            py: 1.2,
            borderRadius: 2.5,
            backdropFilter: "blur(4px)",
            "&:hover": {
              borderColor: isDark ? "#fff" : primary,
              bgcolor: isDark ? "rgba(255,255,255,0.06)" : `${primary}0d`,
              transform: "translateY(-2px)",
            },
            transition: "all 0.25s ease",
          }}
        >
          {community.hero.ctaSecondary.label}
        </Button>
      )}
    </Stack>
  );
}

function HeroContent({
  community,
  isDark,
  isVisible,
  primary,
  primaryDark,
  primaryLight,
  imagePosition,
}: {
  readonly community: CommunitySiteConfig;
  readonly isDark: boolean;
  readonly isVisible: boolean;
  readonly primary: string;
  readonly primaryDark: string;
  readonly primaryLight: string;
  readonly imagePosition: "left" | "right";
}) {
  const justifyContent = imagePosition === "right" ? "flex-start" : "flex-end";

  return (
    <Container
      maxWidth="lg"
      sx={{
        position: "relative",
        zIndex: 2,
        height: "100%",
        minHeight: { md: "92vh" },
        display: "flex",
        alignItems: "center",
      }}
    >
      <Grid container spacing={4} alignItems="center" justifyContent={justifyContent}>
        <Grid size={{ xs: 12, md: 7, lg: 8, xl: 8 }} sx={{ pr: { lg: 6, xl: 8 }, position: "relative", zIndex: 3 }}>
          <Stack spacing={3.5}>
            <AnimatedBox isVisible={isVisible} delay={0.1}>
              <Chip
                label="Comunidade parceira da Codaqui"
                sx={{
                  bgcolor: isDark ? `${primary}22` : `${primary}14`,
                  color: isDark ? primaryLight : primaryDark,
                  border: 1,
                  borderColor: isDark ? `${primary}44` : `${primary}33`,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  backdropFilter: "blur(4px)",
                }}
              />
            </AnimatedBox>

            <AnimatedBox isVisible={isVisible} delay={0.2}>
              <Typography
                variant="h1"
                component="h1"
                fontWeight={900}
                sx={{
                  fontSize: { xs: "2.25rem", sm: "3.25rem", md: "clamp(3rem, 5vw, 4rem)", lg: "clamp(3.25rem, 4vw, 4.25rem)", xl: "clamp(3.5rem, 3.5vw, 4.5rem)" },
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  overflow: "visible",
                  position: "relative",
                  zIndex: 3,
                  background: isDark
                    ? `linear-gradient(135deg, #ffffff 0%, ${primaryLight} 55%, ${primary} 100%)`
                    : `linear-gradient(135deg, #0a1f14 0%, ${primaryDark} 55%, ${primary} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {community.hero.title}
              </Typography>
            </AnimatedBox>

            <AnimatedBox isVisible={isVisible} delay={0.3}>
              <Typography
                variant="h5"
                component="p"
                sx={{
                  fontWeight: 400,
                  color: isDark ? "rgba(255,255,255,0.82)" : "rgba(10,31,20,0.78)",
                  maxWidth: 560,
                  lineHeight: 1.5,
                }}
              >
                {community.hero.subtitle}
              </Typography>
            </AnimatedBox>

            <AnimatedBox isVisible={isVisible} delay={0.4}>
              <HeroCtas
                community={community}
                isDark={isDark}
                primary={primary}
                primaryDark={primaryDark}
              />
            </AnimatedBox>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

function HeroFade({ isDark }: { readonly isDark: boolean }) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 120,
        background: isDark
          ? "linear-gradient(to top, #050a08 0%, transparent 100%)"
          : "linear-gradient(to top, #f4fbf7 0%, transparent 100%)",
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Hero replicável para sites de comunidades parceiras.
 *
 * Ativa quando `community.heroVisual` está presente. Aplica uma imagem de
 * fundo/silhueta com tratamento duotone na cor da marca, mantendo a identidade
 * visual da comunidade sem fugir do design system Codaqui.
 */
export default function CommunityHero({ community }: CommunityHeroProps): React.JSX.Element | null {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const visual = community.heroVisual;
  const { isVisible, offsetY } = useScrollReveal();

  const primary = community.theme.primary;
  const primaryDark = community.theme.primaryDark;
  const primaryLight = community.theme.primaryLight;
  const blendColor = visual?.blendColor ?? primary;

  if (!visual) return null;

  const imagePosition = visual.imagePosition ?? "right";

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: "auto", md: "92vh" },
        py: { xs: 8, md: 0 },
        overflow: "hidden",
        bgcolor: isDark ? "#050a08" : "#f4fbf7",
        color: isDark ? "#fff" : "#0a1f14",
        transition: "background-color 0.3s ease",
      }}
    >
      <HeroBackground
        isDark={isDark}
        primary={primary}
        primaryDark={primaryDark}
        imagePosition={imagePosition}
      />

      <HeroImage
        visual={visual}
        isDark={isDark}
        isVisible={isVisible}
        offsetY={offsetY}
        primary={primary}
        primaryDark={primaryDark}
        primaryLight={primaryLight}
        blendColor={blendColor}
        imagePosition={imagePosition}
      />

      <HeroGrid isDark={isDark} primary={primary} primaryLight={primaryLight} offsetY={offsetY} />

      <HeroContent
        community={community}
        isDark={isDark}
        isVisible={isVisible}
        primary={primary}
        primaryDark={primaryDark}
        primaryLight={primaryLight}
        imagePosition={imagePosition}
      />

      <HeroFade isDark={isDark} />
    </Box>
  );
}
