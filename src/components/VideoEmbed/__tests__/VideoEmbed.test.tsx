import React from "react";
import { render, screen } from "@testing-library/react";
import VideoEmbed from "../index";

describe("VideoEmbed", () => {
  describe("YouTube URL parsing", () => {
    it("extracts video ID from youtube.com/watch?v= URL", () => {
      render(<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />);
      expect(screen.getByTitle("Vídeo")).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("extracts video ID from youtu.be/ short URL", () => {
      render(<VideoEmbed url="https://youtu.be/dQw4w9WgXcQ" />);
      expect(screen.getByTitle("Vídeo")).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("extracts video ID from youtube.com/embed/ URL", () => {
      render(<VideoEmbed url="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
      expect(screen.getByTitle("Vídeo")).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("uses URL as-is when not a recognized YouTube URL", () => {
      const externalUrl = "https://player.vimeo.com/video/123456";
      render(<VideoEmbed url={externalUrl} />);
      expect(screen.getByTitle("Vídeo")).toHaveAttribute("src", externalUrl);
    });
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
