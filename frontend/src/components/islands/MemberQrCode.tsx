// QR code da vanity URL do membro (carteirinha). Ilha mínima sem MUI —
// usada na rota estática /@<handle>, onde o cartão é HTML estático.
import { QRCodeSVG } from "qrcode.react";

export default function MemberQrCode({ value }: Readonly<{ value: string }>) {
  return (
    <span style={{ display: "inline-block", textAlign: "center" }}>
      <span
        style={{
          display: "inline-block",
          background: "white",
          padding: 12,
          borderRadius: 8,
        }}
      >
        <QRCodeSVG
          value={value}
          size={120}
          level="M"
          marginSize={0}
          fgColor="var(--cq-color-success)"
        />
      </span>
      <span
        style={{
          display: "block",
          marginTop: 4,
          fontSize: "0.75rem",
          color: "var(--cq-text-secondary)",
        }}
      >
        Escaneie para ver o perfil
      </span>
    </span>
  );
}
