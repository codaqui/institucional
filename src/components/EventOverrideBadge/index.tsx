import React from "react";
import { Chip } from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import type { EventOverride } from "../../utils/event-override";

interface EventOverrideBadgeProps {
  readonly override: EventOverride;
}

/**
 * Chip exibido quando um evento tem metadados verificados/corrigidos
 * por um organizador (override editado via painel admin e persistido
 * no backend, tabela event_overrides).
 */
export default function EventOverrideBadge({
  override,
}: EventOverrideBadgeProps): React.JSX.Element {
  return (
    <Chip
      size="small"
      color="success"
      icon={<VerifiedIcon />}
      label={`Verificado por @${override.ownerHandle}`}
      title={override.reason ?? "Metadados corrigidos pelo organizador"}
    />
  );
}
