import React from "react";
import CommunityTransparenciaPage from "@site/comunidades/shared/components/CommunityTransparenciaPage";
import community from "../../community.config";

export default function ElasNoCodigoTransparencia(): React.JSX.Element {
  return <CommunityTransparenciaPage community={community} />;
}
