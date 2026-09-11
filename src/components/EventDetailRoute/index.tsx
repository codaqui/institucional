import React from "react";
import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import type { EventSummary } from "../../data/events";
import EventoDetalhePage from "../../pages/eventos/detalhe";
import {
  buildEventJsonLd,
  buildEventPublicPath,
  resolveEventImageUrl,
  truncateEventSummary,
} from "../../utils/event-path";

interface EventDetailRouteProps {
  /** EventSummary injetado pelo plugin event-pages via modules.content. */
  readonly content: EventSummary;
}

export default function EventDetailRoute({
  content: event,
}: EventDetailRouteProps): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const path = buildEventPublicPath(event);
  const absoluteUrl = `${siteConfig.url}${path}`;
  const imageUrl = resolveEventImageUrl(event.imageUrl, siteConfig.url);
  const description = truncateEventSummary(event.summary ?? "");
  const jsonLd = buildEventJsonLd(event, absoluteUrl);

  return (
    <>
      <Head>
        <title>{`${event.title} — Codaqui`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={absoluteUrl} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:alt" content={event.title} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={absoluteUrl} />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd).replace(/</g, "\\u003c")}
        </script>
      </Head>
      <EventoDetalhePage
        routeSource={event.source}
        routeSourceId={event.sourceId}
        routeEventId={event.id}
        initialEvent={event}
      />
    </>
  );
}
