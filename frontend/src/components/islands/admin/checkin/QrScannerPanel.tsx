/**
 * Painel de leitura por câmera (qr-scanner by Nimiq) — subcomponente da
 * ilha de check-in. Port de `src/pages/admin/eventos-checkin.tsx`.
 *
 * qr-scanner abstrai toda a complexidade de câmera:
 *   • Usa BarcodeDetector nativa (Chrome/Android) quando disponível → <1 frame latency
 *   • Fallback via WebWorker + canvas (Safari/Firefox/Samsung) → não bloqueia a UI
 *   • Gerencia getUserMedia, loadedmetadata, facingMode e cleanup internamente
 *
 * Responsabilidades que ficam no CheckinApp:
 *   • Instanciar/destruir o QrScanner quando o usuário ativa/para a câmera
 *   • Cooldown de 3s por token para evitar disparos duplos na mesma leitura
 */
import type { RefObject } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import VideocamIcon from "@mui/icons-material/Videocam";

interface QrScannerPanelProps {
  cameraSupported: boolean;
  cameraActive: boolean;
  cameraStarting: boolean;
  cameraError: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onStart: () => void;
  onStop: () => void;
}

export default function QrScannerPanel({
  cameraSupported,
  cameraActive,
  cameraStarting,
  cameraError,
  videoRef,
  onStart,
  onStop,
}: QrScannerPanelProps): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <QrCodeScannerIcon color="primary" />
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            Ler QR Code pela câmera
          </Typography>
        </Box>

        {/* Câmera indisponível no contexto (HTTP, iframe sem permissão, etc.) */}
        {!cameraSupported && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            A câmera não está disponível neste navegador. Use o campo de token manual
            abaixo ou acesse via Chrome em um dispositivo com câmera.
          </Alert>
        )}

        {cameraError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {cameraError}
          </Alert>
        )}

        {/*
          O <video> é sempre renderizado (ref estável) e NUNCA fica
          `display:none`: o construtor do qr-scanner detecta vídeo
          escondido e o zera (width/height/opacity = 0) para "proteger"
          o Safari — com isso a preview ficava invisível mesmo com o
          stream ativo. A visibilidade é controlada pelo wrapper, e o
          vídeo permanece `display:block` para a lib.
          A lib injeta o overlay de destaque de região no elemento pai
          do vídeo (o wrapper), escondendo-o junto quando inativo.
        */}
        <div
          id="checkin-camera-preview-wrapper"
          style={{ display: cameraActive ? "block" : "none", marginBottom: 12 }}
        >
          <video
            id="checkin-camera-preview"
            ref={videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              borderRadius: 8,
              backgroundColor: "black",
              display: "block",
            }}
          />
        </div>

        {cameraSupported && (
          <Button
            id="checkin-camera-toggle"
            fullWidth
            variant={cameraActive ? "outlined" : "contained"}
            color={cameraActive ? "error" : "primary"}
            size="large"
            disabled={cameraStarting}
            startIcon={cameraActive ? <StopCircleIcon /> : <VideocamIcon />}
            onClick={cameraActive ? onStop : onStart}
          >
            {cameraActive ? "Parar câmera" : cameraStarting ? "Ativando..." : "Ativar câmera"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
