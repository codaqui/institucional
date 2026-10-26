/**
 * Card de um evento EXTERNO na lista unificada do hub — badges de fonte,
 * override, ownership e features, com ações de metadados/plugins/pedidos/check-in.
 * Port de `src/pages/admin/eventos.tsx` (Docusaurus) — `Link` virou `<a>`.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import ExtensionIcon from "@mui/icons-material/Extension";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { FEATURE_LABEL, formatDateTime, type HubRow } from "./types";

interface ExternalEventCardProps {
  row: HubRow & { kind: "external" };
  sourceLabel: (sourceKey: string) => string;
  onOrdersClick: (eventKey: string, title: string) => void;
}

export default function ExternalEventCard({
  row,
  sourceLabel,
  onOrdersClick,
}: Readonly<ExternalEventCardProps>): React.JSX.Element {
  const ev = row.event;
  const eventKey = `${ev.sourceKey}:${ev.id}`;
  const overrideQuery = `sourceKey=${encodeURIComponent(ev.sourceKey)}&eventId=${encodeURIComponent(ev.id)}`;
  const checkinEventParam = encodeURIComponent(`external:${eventKey}`);

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 700 }}>{ev.title}</Typography>
          <Chip
            label={`Externo · ${sourceLabel(ev.sourceKey)}`}
            size="small"
            variant="outlined"
          />
          {row.hasOverride && (
            <Chip label="Override" size="small" color="primary" variant="outlined" />
          )}
          {row.canEdit && (
            <Chip label="Você pode editar" size="small" color="success" variant="outlined" />
          )}
          {row.features.map((f) => (
            <Chip
              key={f}
              label={FEATURE_LABEL[f] ?? f}
              size="small"
              color="secondary"
              variant="outlined"
            />
          ))}
          {row.communityProjectKey && (
            <Chip
              label={`Comunidade: ${row.communityProjectKey}`}
              size="small"
              variant="outlined"
            />
          )}
          {row.ownerHandle && (
            <Chip
              label={`Owner: @${row.ownerHandle}`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(ev.startAt)}
            {ev.location ? ` · ${ev.location}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            component="a"
            href={`/admin/overrides?tab=0&${overrideQuery}`}
          >
            Editar metadados
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<ExtensionIcon />}
            component="a"
            href={`/admin/overrides?tab=2&${overrideQuery}`}
          >
            Plugins
          </Button>
          {row.features.includes("payments") && (
            <Button
              size="small"
              variant="text"
              startIcon={<ReceiptLongIcon />}
              onClick={() => onOrdersClick(eventKey, ev.title)}
            >
              Pedidos
            </Button>
          )}
          {row.features.includes("checkin") && (
            <Button
              size="small"
              variant="text"
              startIcon={<HowToRegIcon />}
              component="a"
              href={`/admin/eventos-checkin?event=${checkinEventParam}`}
            >
              Check-in
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
