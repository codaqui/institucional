import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "CODAQUI.dev",
  tagline: "Democratizando o ensino tecnológico para jovens",
  favicon: "img/favicon.png",

  url: "https://codaqui.dev",
  baseUrl: "/",

  organizationName: "codaqui",
  projectName: "institucional",

  onBrokenLinks: "warn",
  onBrokenAnchors: "warn",

  // Ensure window.gtag is defined before the async Google script loads,
  // preventing "window.gtag is not a function" on early route changes.
  headTags: [
    {
      tagName: "script",
      attributes: { type: "text/javascript" },
      innerHTML: `window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};`,
    },
  ],

  markdown: {
    format: "detect",
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
      onBrokenMarkdownImages: "warn",
    },
  },

  i18n: {
    defaultLocale: "pt-BR",
    locales: ["pt-BR"],
  },

  themes: [
    "@docusaurus/theme-live-codeblock",
    "@docusaurus/theme-mermaid",
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          path: "trilhas",
          routeBasePath: "trilhas",
          sidebarPath: "./sidebars.ts",
          breadcrumbs: true,

          // "Edit this page" button → opens file directly in GitHub web editor
          editUrl: ({ docPath }) =>
            `https://github.com/codaqui/institucional/edit/develop/trilhas/${docPath}`,

          // Show git-based metadata on each lesson
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,

          // Include markdown and MDX
          include: ["**/*.md", "**/*.mdx"],

          // Remark plugin: math support (optional, already excluded if not installed)
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: {
          path: "blog",
          showReadingTime: true,
          blogTitle: "Blog",
          blogSidebarCount: 10,
          blogSidebarTitle: "Posts recentes",
          onInlineAuthors: "ignore",
          tagsBasePath: "category",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
        gtag: {
          trackingID: "G-CL043JTTND",
          anonymizeIP: true,
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "",
      logo: {
        alt: "Codaqui — Democratizando o ensino de tecnologia",
        src: "img/logo_principal.svg",
        srcDark: "img/logo_monocromatica.svg",
        width: 122,
        height: 33,
      },
      items: [
        {
          label: "Início",
          to: "/",
          position: "left",
          activeBaseRegex: "^/$",
        },
        {
          label: "Sobre",
          position: "left",
          type: "dropdown",
          items: [
            { label: "Equipe", to: "/sobre/equipe" },
            { label: "Associação", to: "/sobre/ong" },
            { label: "Linha do Tempo", to: "/sobre/timeline" },
            { label: "Pais e Responsáveis", to: "/sobre/pais-responsaveis" },
            { label: "Código de Conduta", to: "/sobre/conduta" },
          ],
        },
        {
          label: "Participe",
          position: "left",
          type: "dropdown",
          items: [
            { label: "#QueroEstudar", to: "/participe/estudar" },
            { label: "#QueroApoiar", to: "/participe/apoiar" },
            { label: "#QueroMentoria", to: "/participe/mentoria" },
          ],
        },
        {
          label: "Trilhas",
          position: "left",
          type: "dropdown",
          items: [
            { label: "Visão Geral", to: "/trilhas" },
            { label: "Python 101", to: "/trilhas/python/" },
            { label: "GitHub 101", to: "/trilhas/github/" },
          ],
        },
        {
          label: "Projetos",
          to: "/projetos",
          position: "left",
        },
        {
          label: "Blog",
          to: "/blog",
          position: "left",
        },
        {
          label: "Contato",
          to: "/contato",
          position: "left",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Comunidade",
          items: [
            {
              label: "Discord",
              href: "https://discord.com/invite/xuTtxqCPpz",
            },
            {
              label: "WhatsApp",
              href: "https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up",
            },
            {
              label: "GitHub",
              href: "https://github.com/codaqui",
            },
          ],
        },
        {
          title: "Redes Sociais",
          items: [
            {
              label: "Twitter",
              href: "https://twitter.com/codaquidev",
            },
            {
              label: "LinkedIn",
              href: "https://www.linkedin.com/company/codaqui",
            },
            {
              label: "Instagram",
              href: "https://instagram.com/codaqui.dev",
            },
            {
              label: "YouTube",
              href: "https://youtube.com/@codaqui",
            },
          ],
        },
        {
          title: "Mais",
          items: [
            {
              label: "Blog",
              to: "/blog",
            },
            {
              label: "GitHub",
              href: "https://github.com/codaqui/institucional",
            },
          ],
        },
      ],
      copyright: `Codaqui © Copyright ${new Date().getFullYear()} - Todos os direitos reservados - CNPJ 44.593.429/0001-05`,
    },
    liveCodeBlock: {
      playgroundPosition: "bottom",
    },
    mermaid: {
      theme: { light: "neutral", dark: "dark" },
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["python", "bash", "regex"],
    },
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: true,
    },
    giscus: {
      repo: "codaqui/institucional",
      repoId: "R_kgDOG9s0Ng",
      category: "Blog",
      categoryId: "DIC_kwDOG9s0Ns4CRk25",
      mapping: "og:title",
      strict: "0",
      reactionsEnabled: "1",
      emitMetadata: "1",
      inputPosition: "bottom",
      theme: "preferred_color_scheme",
      lang: "pt",
    },
  } satisfies Preset.ThemeConfig & { giscus: Record<string, string> },
};

export default config;
