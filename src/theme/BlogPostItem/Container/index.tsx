import React, { type ReactNode } from "react";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import Box from "@mui/material/Box";
import type { Props } from "@theme/BlogPostItem/Container";

export default function BlogPostItemContainer({ children, className }: Props): ReactNode {
  const { isBlogPostPage } = useBlogPost();

  return (
    <Box
      component="article"
      className={className}
      sx={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid",
        borderColor: isBlogPostPage ? "divider" : "rgba(0, 0, 0, 0.08)",
        borderRadius: isBlogPostPage ? 3 : 2.5,
        bgcolor: "background.paper",
        px: { xs: 3, md: isBlogPostPage ? 5 : 4 },
        py: { xs: 3, md: isBlogPostPage ? 5 : 4 },
        transition: isBlogPostPage
          ? undefined
          : "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
        boxShadow: isBlogPostPage ? 1 : "none",
        "&:hover": isBlogPostPage
          ? undefined
          : {
              borderColor: "primary.main",
              boxShadow: 1,
              bgcolor: "background.default",
            },
      }}
    >
      <Box
        className={isBlogPostPage ? "codaqui-blog-post-page-surface" : "codaqui-blog-list-card"}
      >
        {children}
      </Box>
    </Box>
  );
}
