import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GiscusIsland from "../GiscusIsland";
import {
  GISCUS_CONFIG,
  getAssembliesGiscusConfig,
} from "../../../data/giscus";

vi.mock("@giscus/react", () => ({
  default: ({
    category,
    categoryId,
    mapping,
    loading,
  }: {
    category?: string;
    categoryId?: string;
    mapping: string;
    loading?: string;
  }) => (
    <div
      data-testid="giscus"
      data-category={category}
      data-category-id={categoryId}
      data-mapping={mapping}
      data-loading={loading}
    />
  ),
}));

describe("GiscusIsland", () => {
  it("mantém a categoria e o mapping do blog por padrão", () => {
    render(<GiscusIsland />);

    expect(screen.getByTestId("giscus")).toHaveAttribute("data-category", "Blog");
    expect(screen.getByTestId("giscus")).toHaveAttribute(
      "data-category-id",
      "DIC_kwDOG9s0Ns4CRk25",
    );
    expect(screen.getByTestId("giscus")).toHaveAttribute("data-mapping", "og:title");
    expect(screen.getByTestId("giscus")).toHaveAttribute("data-loading", "lazy");
  });

  it("usa a categoria Reuniões por pathname sem alterar o default do blog", () => {
    const config = getAssembliesGiscusConfig(" test-category ");

    expect(config).not.toBeNull();
    render(<GiscusIsland config={config!} />);

    expect(screen.getByTestId("giscus")).toHaveAttribute("data-category", "Reuniões");
    expect(screen.getByTestId("giscus")).toHaveAttribute("data-category-id", "test-category");
    expect(screen.getByTestId("giscus")).toHaveAttribute("data-mapping", "pathname");
    expect(GISCUS_CONFIG.category).toBe("Blog");
    expect(GISCUS_CONFIG.mapping).toBe("og:title");
  });

  it.each([undefined, "", "   "])("não cria configuração de Assembleias sem ID: %j", (categoryId) => {
    expect(getAssembliesGiscusConfig(categoryId)).toBeNull();
  });
});
