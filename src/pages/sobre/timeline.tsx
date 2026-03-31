import React from "react";
import Layout from "@theme/Layout";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineDot,
  TimelineContent,
  TimelineOppositeContent,
} from "@mui/lab";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Container,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { timelineEvents, type TimelineEvent } from "../../data/timeline";

export default function TimelinePage(): React.JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Layout
      title="Linha do Tempo"
      description="Acompanhe os principais marcos da história da Codaqui"
    >
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
          py: { xs: 6, md: 8 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" component="h1" fontWeight={800} color="white">
            🕐 Linha do Tempo
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 600, mx: "auto", mt: 2 }}
          >
            Acompanhe os principais marcos da história da Codaqui
          </Typography>
        </Container>
      </Box>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>

        <Timeline position={isMobile ? "right" : "alternate"}>
          {timelineEvents.map((event: TimelineEvent, index: number) => (
            <TimelineItem key={event.year}>
              <TimelineOppositeContent
                sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}
              >
                <Typography variant="h5" fontWeight={700} color="text.secondary">
                  {event.year}
                </Typography>
              </TimelineOppositeContent>

              <TimelineSeparator>
                <TimelineDot
                  color={event.color === "grey" ? "grey" : event.color}
                  sx={{ fontSize: "1.2rem", p: 1.5 }}
                >
                  {event.icon}
                </TimelineDot>
                {index < timelineEvents.length - 1 && <TimelineConnector />}
              </TimelineSeparator>

              <TimelineContent sx={{ pb: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    {isMobile && (
                      <Typography variant="h6" color="text.secondary" mb={1}>
                        {event.year}
                      </Typography>
                    )}
                    <Typography variant="h5" fontWeight={700} mb={1}>
                      {event.label}
                    </Typography>
                    {event.description && (
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {event.description}
                      </Typography>
                    )}
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {event.items.map((item, i) => (
                        <Box component="li" key={i}>
                          <Typography variant="body2">{item}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Container>
    </Layout>
  );
}
