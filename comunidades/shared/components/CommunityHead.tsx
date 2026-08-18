import React from "react";
import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import type { CommunitySiteConfig } from "../types";

interface CommunityHeadProps {
  community: CommunitySiteConfig;
  /** Título da página. Padrão: nome da comunidade. */
  title?: string;
  /** Descrição da página. Padrão: descrição da comunidade. */
  description?: string;
  /** Imagem OG específica. Padrão: `community.socialImage` → `community.logoUrl`. */
  image?: string;
  /** Tipo do conteúdo para OG. Padrão: "website". */
  type?: "website" | "article" | "profile";
}

/**
 * Injeta metadados Open Graph / Twitter específicos da comunidade.
 *
 * O Docusaurus já gera tags base a partir do `themeConfig.image`, mas esse
 * componente as sobrescreve para que cards sociais (WhatsApp, Twitter/X,
 * LinkedIn, Facebook) mostrem a identidade da comunidade parceira em vez da
 * imagem institucional da Codaqui.
 */
export default function CommunityHead({
  community,
  title,
  description,
  image,
  type = "website",
}: CommunityHeadProps): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const siteUrl = siteConfig.url.replace(/\/$/, "");

  const pageTitle = title ?? community.name;
  const pageDescription = description ?? community.description;
  const pageImage = image ?? community.socialImage ?? community.logoUrl;
  // Garante URL absoluta para imagens locais (crawlers não resolvem paths relativos).
  const absoluteImage = pageImage.startsWith("http")
    ? pageImage
    : `${siteUrl}${pageImage}`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />

      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:alt" content={community.name} />
      <meta property="og:type" content={type} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:image:alt" content={community.name} />
    </Head>
  );
}
