import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "TI Social",
  tagline: "Tecnologia a serviço do impacto social",
  favicon: "img/favicon.ico",

  url: "https://tisocial.org.br",
  baseUrl: "/",

  organizationName: "codaqui",
  projectName: "tisocial",

  onBrokenLinks: "warn",
  onBrokenAnchors: "warn",

  i18n: {
    defaultLocale: "pt-BR",
    locales: ["pt-BR"],
  },

  presets: [
    [
      "classic",
      {
        docs: false,
        blog: {
          path: "./blog",
          routeBasePath: "campanhas",
          authorsMapPath: "authors.yml",
          blogTitle: "Campanhas e Transparência",
          blogDescription: "Prestação de contas e resultados das nossas campanhas mensais.",
          blogSidebarTitle: "Todas as Campanhas",
          blogSidebarCount: "ALL",
          showReadingTime: true,
          postsPerPage: 20,
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "TI Social",
      logo: {
        alt: "TI Social Logo",
        src: "img/logo.png",
      },
      items: [
        {
          label: "Início",
          to: "/",
          position: "left",
        },
        {
          label: "Campanhas",
          to: "/campanhas",
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
              label: "Instagram",
              href: "https://www.instagram.com/tisocialmaringa",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} TI Social. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
