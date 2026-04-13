import React, { useEffect, useState, type ReactNode } from "react";
import { translate } from "@docusaurus/Translate";
import { PageMetadata } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import NotFoundContent from "@theme/NotFound/Content";

export default function NotFoundPage(): ReactNode {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const path = globalThis.location.pathname;

    // /@username → /membros/perfil?handle=username
    const vanityMatch = /^\/@([a-zA-Z0-9_-]+)\/?$/.exec(path);
    if (vanityMatch) {
      setRedirecting(true);
      globalThis.location.replace(`/membros/perfil?handle=${vanityMatch[1]}`);
    }
  }, []);

  const title = translate({
    id: "theme.NotFound.title",
    message: "Page Not Found",
  });

  if (redirecting) {
    return (
      <>
        <PageMetadata title="Redirecionando…" />
        <Layout>
          <main className="container margin-vert--xl">
            <div className="row">
              <div className="col col--6 col--offset-3" style={{ textAlign: "center" }}>
                <p>Redirecionando para o perfil…</p>
              </div>
            </div>
          </main>
        </Layout>
      </>
    );
  }

  return (
    <>
      <PageMetadata title={title} />
      <Layout>
        <NotFoundContent />
      </Layout>
    </>
  );
}
