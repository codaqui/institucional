import React from "react";
import { Redirect } from "@docusaurus/router";

export default function AdminTransferenciasRedirect(): React.JSX.Element {
  return <Redirect to="/admin/lancamento?tab=transferencias" />;
}
