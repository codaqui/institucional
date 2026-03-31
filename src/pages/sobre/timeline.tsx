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
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography
          variant="h3"
          component="h1"
          textAlign="center"
          mb={1}
          fontWeight={700}
        >
          🕐 Linha do Tempo
        </Typography>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          textAlign="center"
          mb={6}
        >
          Acompanhe os principais marcos da história da Codaqui
        </Typography>

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
                <Card elevation={0} sx={{ border: 1, borderColor: "divider" }}>
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
