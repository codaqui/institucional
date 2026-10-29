import { visit } from "unist-util-visit";
import type { Root, Image, Html } from "mdast";
import type { VFile } from "vfile";

function filePathOf(file: VFile): string {
  return file.path || file.history[0] || "";
}

const trilhaRegex = /content\/trilhas\/([^/]+)\//;

export function remarkContentAssets() {
  return (tree: Root, file: VFile) => {
    const path = filePathOf(file).replaceAll("\\", "/");
    const trilha = trilhaRegex.exec(path)?.[1];
    const isBlog = path.includes("content/blog/");

    const rewrite = (url: string): string => {
      if (isBlog) return url.replace(/^(?:\.\/)?img\//, "/blog-assets/img/");
      if (trilha) return url.replace(/^\.\/assets\//, `/trilhas-assets/${trilha}/assets/`);
      return url;
    };

    visit(tree, "image", (node: Image) => {
      node.url = rewrite(node.url);
    });
    visit(tree, "html", (node: Html) => {
      if (trilha) {
        node.value = node.value.replace(
          /(src=["'])\.\/assets\//g,
          `$1/trilhas-assets/${trilha}/assets/`
        );
      }
      if (isBlog) {
        node.value = node.value.replace(/(src=["'])(?:\.\/)?img\//g, "$1/blog-assets/img/");
      }
    });
  };
}
