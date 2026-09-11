import React from "react";
import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import MembroPerfilPage from "../../pages/membros/perfil";
import {
  buildMemberJsonLd,
  buildMemberPath,
  defaultMemberBioFallback,
  truncateMemberBio,
} from "../../utils/member-path";
import type { PublicMemberProfile } from "../../utils/member-path";

interface MemberProfileRouteProps {
  /** PublicMemberProfile injetado pelo plugin member-pages via modules.content. */
  readonly content: PublicMemberProfile;
}

export default function MemberProfileRoute({
  content: member,
}: MemberProfileRouteProps): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const absoluteUrl = `${siteConfig.url}${buildMemberPath(member.githubHandle)}`;
  const description = truncateMemberBio(
    member.bio,
    defaultMemberBioFallback(member.name)
  );
  const jsonLd = buildMemberJsonLd(member, absoluteUrl);

  return (
    <>
      <Head>
        <title>{`${member.name} (@${member.githubHandle}) — Codaqui`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={member.name} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={absoluteUrl} />
        <meta property="og:image" content={member.avatarUrl} />
        <meta property="og:image:alt" content={member.name} />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href={absoluteUrl} />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd).replace(/</g, "\\u003c")}
        </script>
      </Head>
      <MembroPerfilPage routeHandle={member.githubHandle} initialMember={member} />
    </>
  );
}
