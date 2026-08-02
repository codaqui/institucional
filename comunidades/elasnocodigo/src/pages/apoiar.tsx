import React from "react";
import CommunityApoiarPage from "@site/comunidades/shared/components/CommunityApoiarPage";
import community from "../../community.config";

export default function ElasNoCodigoApoiar(): React.JSX.Element {
  return (
    <CommunityApoiarPage
      community={community}
      heroTitle={`💜 Apoie a ${community.shortName}`}
      heroDescription="Sua contribuição fortalece encontros, lives e iniciativas que promovem a inclusão de mulheres na tecnologia."
    />
  );
}
