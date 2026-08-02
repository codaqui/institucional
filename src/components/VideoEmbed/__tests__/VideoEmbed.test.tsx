import React from "react";
import { render, screen } from "@testing-library/react";
import VideoEmbed from "../index";

describe("VideoEmbed", () => {
  it.each([
    [
      "youtube.com/watch?v= URL",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
    [
      "youtu.be/ short URL",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
    [
      "youtube.com/embed/ URL",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
    [
      "non-YouTube URL",
      "https://player.vimeo.com/video/123456",
      "https://player.vimeo.com/video/123456",
    ],
  ])("extracts/embeds correctly for %s", (_, url, expectedSrc) => {
    render(<VideoEmbed url={url} />);
    expect(screen.getByTitle("Vídeo")).toHaveAttribute("src", expectedSrc);
  });

  describe("title prop", () => {
    it('uses "Vídeo" as the default title', () => {
      render(<VideoEmbed url="https://youtu.be/abc1234abcd" />);
      expect(screen.getByTitle("Vídeo")).toBeInTheDocument();
    });

    it("uses the custom title when provided", () => {
      render(<VideoEmbed url="https://youtu.be/abc1234abcd" title="Apresentação" />);
      expect(screen.getByTitle("Apresentação")).toBeInTheDocument();
    });
  });

  describe("caption", () => {
    it("renders caption when provided", () => {
      render(<VideoEmbed url="https://youtu.be/abc1234abcd" caption="Aula 1 — Introdução" />);
      expect(screen.getByText("Aula 1 — Introdução")).toBeInTheDocument();
    });

    it("does not render caption element when omitted", () => {
      const { container } = render(<VideoEmbed url="https://youtu.be/abc1234abcd" />);
      expect(container.querySelector("figcaption")).not.toBeInTheDocument();
    });
  });

  it("wraps content in a figure element", () => {
    const { container } = render(<VideoEmbed url="https://youtu.be/abc1234abcd" />);
    expect(container.querySelector("figure")).toBeInTheDocument();
  });
});
