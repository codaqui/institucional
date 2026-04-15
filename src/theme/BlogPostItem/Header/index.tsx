import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatReadingTime(readingTime?: number): string | null {
  if (readingTime === undefined) {
    return null;
  }

  const minutes = Math.max(1, Math.ceil(readingTime));
  return `${minutes} min de leitura`;
}

export default function BlogPostItemHeader(): ReactNode {
  const { metadata, assets, isBlogPostPage } = useBlogPost();
  const { authors, date, description, permalink, readingTime, tags, title } = metadata;
  const headingComponent = isBlogPostPage ? "h1" : "h2";
  const headingVariant = isBlogPostPage ? "h3" : "h4";
  const readingTimeLabel = formatReadingTime(readingTime);
  const visibleTags = tags.slice(0, isBlogPostPage ? 3 : 2);

  return (
    <Box component="header" className="codaqui-blog-post-header" sx={{ mb: { xs: 3, md: 4 } }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          label={isBlogPostPage ? "Post do blog" : "Leitura recomendada"}
          size="small"
          variant="outlined"
          color="success"
          sx={{ fontWeight: 700 }}
        />
        {visibleTags.map((tag) => (
          <Chip
            key={tag.permalink}
            label={tag.label}
            size="small"
            variant="outlined"
            component="a"
            href={tag.permalink}
            clickable
            sx={{ fontWeight: 600 }}
          />
        ))}
      </Stack>

      <Typography
        component={headingComponent}
        variant={headingVariant}
        fontWeight={800}
        sx={{ mb: 1.5, textWrap: "balance" }}
      >
        {isBlogPostPage ? title : <Link to={permalink}>{title}</Link>}
      </Typography>

      {isBlogPostPage && description && description !== title && (
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ mb: 2.5, maxWidth: 760, fontWeight: 500 }}
        >
          {description}
        </Typography>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: authors.length ? 2.5 : 0 }}>
        <Chip label={formatDate(date)} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        {readingTimeLabel && (
          <Chip label={readingTimeLabel} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        )}
      </Stack>

      {authors.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {authors.map((author, index) => (
            <Box
              key={`${author.name}-${index}`}
              component={author.url ? "a" : "div"}
              href={author.url}
              target={author.url ? "_blank" : undefined}
              rel={author.url ? "noopener noreferrer" : undefined}
              className="codaqui-blog-post-author"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.25,
                py: 1,
                borderRadius: 999,
                border: "1px solid",
                borderColor: "divider",
                textDecoration: "none",
                color: "inherit",
                bgcolor: "background.default",
              }}
            >
              <Avatar
                alt={author.name ?? "Autor"}
                src={assets.authorsImageUrls[index] ?? author.imageURL}
                sx={{ width: 40, height: 40 }}
              />
              <Box>
                {author.name && (
                  <Typography variant="body2" fontWeight={700}>
                    {author.name}
                  </Typography>
                )}
                {author.title && (
                  <Typography variant="caption" color="text.secondary">
                    {author.title}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
