import React, { type ReactNode } from "react";
import BlogPostItem from "@theme-original/BlogPostItem";
import type BlogPostItemType from "@theme/BlogPostItem";
import type { WrapperProps } from "@docusaurus/types";
import { useBlogPost } from "@docusaurus/plugin-content-blog/client";
import GiscusComponent from "@site/src/components/GiscusComponent";
import useIsBrowser from "@docusaurus/useIsBrowser";

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
  const isBrowser = useIsBrowser();
  const { enableComments = true } = metadata.frontMatter as {
    enableComments?: boolean;
  };

  return (
    <>
      <BlogPostItem {...props} />
      {isBlogPostPage && enableComments && isBrowser && <GiscusComponent />}
    </>
  );
}
