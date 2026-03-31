import React, { type ReactNode } from "react";
import BlogPostItem from "@theme-original/BlogPostItem";
import type BlogPostItemType from "@theme/BlogPostItem";
import type { WrapperProps } from "@docusaurus/types";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import GiscusComponent from "@site/src/components/GiscusComponent";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useIsBrowser from "@docusaurus/useIsBrowser";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

type Props = WrapperProps<typeof BlogPostItemType>;

/**
 * Wraps the original BlogPostItem to inject Giscus comments at the bottom
 * of individual blog post pages.
 *
 * Comments are enabled by default. Disable per-post with:
 *   enableComments: false
 * in the post frontmatter.
 */
export default function BlogPostItemWrapper(props: Props): ReactNode {
  const { metadata, isBlogPostPage } = useBlogPost();
  const { siteConfig } = useDocusaurusContext();
  const isBrowser = useIsBrowser();
  const { enableComments = true } = metadata.frontMatter as {
    enableComments?: boolean;
  };
  const isPreview = Boolean(siteConfig.customFields?.isPreview);

  return (
    <Box sx={{ display: "grid", gap: isBlogPostPage ? 4 : 0 }}>
      <BlogPostItem {...props} />
      {isBlogPostPage && enableComments && isBrowser && !isPreview && (
        <Box
          className="codaqui-blog-comments"
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            bgcolor: "background.paper",
            px: { xs: 3, md: 4 },
            py: { xs: 3, md: 4 },
          }}
        >
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Participe da conversa
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Tem dúvidas, complementos ou quer compartilhar sua experiência? Use os comentários para
            continuar a discussão com a comunidade.
          </Typography>
          <GiscusComponent />
        </Box>
      )}
    </Box>
  );
}
