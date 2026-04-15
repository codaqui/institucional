export default function useDocusaurusContext() {
  return {
    siteConfig: {
      customFields: { apiUrl: "http://localhost:3001" },
      themeConfig: { giscus: {} },
    },
  };
}
