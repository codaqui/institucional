import { describe, expect, it } from "vitest";
import { remarkContentAssets } from "./remark-content-assets";

// mdast mínimo feito à mão — sem depender de parser nos testes
function run(tree: unknown, filePath: string) {
  const file = { path: filePath, history: [filePath] };
  remarkContentAssets()(tree as never, file as never);
  return tree;
}

describe("remarkContentAssets", () => {
  it("reescreve imagem de post do blog", () => {
    const tree = { type: "root", children: [{ type: "image", url: "./img/2022_10_14_hello_world/x.png" }] };
    run(tree, "/repo/frontend/src/content/blog/2022-10-14-hello-world.md");
    expect((tree as never as { children: { url: string }[] }).children[0].url).toBe(
      "/blog-assets/img/2022_10_14_hello_world/x.png"
    );
  });

  it("reescreve img/ sem ./ no blog", () => {
    const tree = { type: "root", children: [{ type: "image", url: "img/pasta/y.gif" }] };
    run(tree, "/repo/frontend/src/content/blog/post.md");
    expect((tree as never as { children: { url: string }[] }).children[0].url).toBe("/blog-assets/img/pasta/y.gif");
  });

  it("reescreve video html da trilha github", () => {
    const tree = {
      type: "root",
      children: [{ type: "html", value: '<video src="./assets/demo.webm" controls></video>' }],
    };
    run(tree, "/repo/frontend/src/content/trilhas/github/page-3.md");
    expect((tree as never as { children: { value: string }[] }).children[0].value).toBe(
      '<video src="/trilhas-assets/github/assets/demo.webm" controls></video>'
    );
  });

  it("não toca em URLs absolutas/externas", () => {
    const tree = {
      type: "root",
      children: [
        { type: "image", url: "https://github.com/user-attachments/x.png" },
        { type: "html", value: '<img src="/img/logo.png" alt="x" />' },
      ],
    };
    run(tree, "/repo/frontend/src/content/blog/post.md");
    const children = (tree as never as { children: { url?: string; value?: string }[] }).children;
    expect(children[0].url).toBe("https://github.com/user-attachments/x.png");
    expect(children[1].value).toBe('<img src="/img/logo.png" alt="x" />');
  });
});
