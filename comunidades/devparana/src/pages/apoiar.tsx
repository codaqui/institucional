import React from "react";
import CommunityApoiarPage from "@site/comunidades/shared/components/CommunityApoiarPage";
import community from "../../community.config";

export default function DevParanaApoiar(): React.JSX.Element {
  return (
    <CommunityApoiarPage
      community={community}
      heroTitle={`💙 Apoie o ${community.shortName}`}
      heroDescription="Sua contribuição mantém meetups locais e o evento itinerante DevParaná na Estrada, levando conteúdo de qualidade para várias cidades do Paraná."
      infoCards={[
        {
          title: "Como sua doação é usada",
          body: `100% direcionada para ações do ${community.shortName}: infraestrutura de eventos, coffee break, deslocamento de palestrantes e brindes. Movimentações registradas no ledger da Associação Codaqui.`,
        },
        {
          title: "Cobertura jurídica",
          body: "Pagamentos processados pela Stripe; recibo emitido pela Associação Codaqui (CNPJ 44.593.429/0001-05). Doações acima de R$ 100 exigem login com GitHub para conformidade fiscal.",
        },
      ]}
    />
  );
}
