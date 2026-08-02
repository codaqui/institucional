import React from "react";
import CommunityApoiarPage from "@site/comunidades/shared/components/CommunityApoiarPage";
import community from "../../community.config";

export default function TiSocialApoiar(): React.JSX.Element {
  return (
    <CommunityApoiarPage
      community={community}
      heroTitle={`💚 Apoie a ${community.shortName}`}
      heroDescription="Sua contribuição mantém vivas campanhas como AUMIGO e Páscoa Solidária, além dos programas de educação digital em Maringá."
      infoCards={[
        {
          title: "Como sua doação é usada",
          body: `100% direcionada para campanhas e ações da ${community.shortName}. Movimentações contabilizadas no ledger da Associação Codaqui e auditáveis na página de transparência.`,
        },
        {
          title: "Cobertura jurídica",
          body: "Pagamentos processados pela Stripe; recibo emitido pela Associação Codaqui (CNPJ 44.593.429/0001-05). Doações acima de R$ 100 exigem login com GitHub para conformidade fiscal.",
        },
      ]}
    />
  );
}
