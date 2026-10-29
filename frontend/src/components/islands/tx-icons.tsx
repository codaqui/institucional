// Resolve o TxIconName (string, lib pura — Task 2) para o componente MUI real,
// espelhando o TX_TYPE_CONFIG original de src/utils/transaction.tsx.
import type { ReactElement } from "react";
import BusinessIcon from "@mui/icons-material/Business";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import type { TxIconName } from "../../lib/transaction";

const TX_ICONS: Record<TxIconName, typeof VolunteerActivismIcon> = {
  VolunteerActivism: VolunteerActivismIcon,
  Business: BusinessIcon,
  ReceiptLong: ReceiptLongIcon,
  KeyboardReturn: KeyboardReturnIcon,
  Storefront: StorefrontIcon,
  CallReceived: CallReceivedIcon,
  CompareArrows: CompareArrowsIcon,
  MoneyOff: MoneyOffIcon,
  ConfirmationNumber: ConfirmationNumberIcon,
  InfoOutlined: InfoOutlinedIcon,
};

export function txTypeIcon(name: TxIconName): ReactElement {
  const Icon = TX_ICONS[name];
  return <Icon fontSize="small" />;
}
