import React from "react";
import CommunityApoiarPage from "@site/comunidades/shared/components/CommunityApoiarPage";
import community from "../../community.config";

export default function CamposTechApoiar(): React.JSX.Element {
  return (
    <CommunityApoiarPage
      community={community}
      heroTitle={`💙 Apoie a ${community.shortName}`}
      heroDescription="Sua contribuição fortalece eventos, mentorias e encontros que impulsionam a tecnologia nos Campos Gerais."
    />
  );
}
