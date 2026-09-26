import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";

interface RegistrationConfirmedCardProps {
  checkinToken: string;
}

export default function RegistrationConfirmedCard({
  checkinToken,
}: RegistrationConfirmedCardProps): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ mb: 4, borderColor: "success.main" }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Inscrição confirmada!
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Apresente o código abaixo no check-in do evento.
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <QRCodeSVG value={checkinToken} size={160} />
        </Box>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: "action.hover",
            fontFamily: "monospace",
            fontWeight: 700,
            textAlign: "center",
            wordBreak: "break-all",
          }}
        >
          {checkinToken}
        </Box>
      </CardContent>
    </Card>
  );
}
