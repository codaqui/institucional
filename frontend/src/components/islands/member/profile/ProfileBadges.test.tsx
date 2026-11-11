import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithMui } from "../../../../test/render-mui";
import ProfileBadges from "./ProfileBadges";

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(writeText) },
  });
}

describe("ProfileBadges", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(document, "execCommand");
  });

  it("links the public SVG with an informative alternative text", () => {
    renderWithMui(<ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />);

    expect(screen.getByRole("heading", { name: "Selo público" })).toBeInTheDocument();
    const badge = screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" });
    expect(badge).toHaveAttribute("src", "/badges/membro-teste.svg");
    expect(badge).toHaveAttribute("width", "640");
    expect(badge).toHaveAttribute("height", "120");
  });

  it("hides only the badge when its SVG fails to load", () => {
    renderWithMui(
      <>
        <ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />
        <p>Horas, eventos e doações</p>
      </>,
    );

    fireEvent.error(screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" }));

    expect(screen.queryByRole("heading", { name: "Selo público" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Selo Codaqui/ })).not.toBeInTheDocument();
    expect(screen.getByText("Horas, eventos e doações")).toBeInTheDocument();
  });

  it("retries with the new src when the handle changes after an error", () => {
    const { rerender } = renderWithMui(
      <ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" }));
    expect(screen.queryByRole("img", { name: /Selo Codaqui/ })).not.toBeInTheDocument();

    rerender(<ProfileBadges name="Membro Sintético" githubHandle="novo-handle" />);

    const retry = screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" });
    expect(retry).toHaveAttribute("src", "/badges/novo-handle.svg");
    fireEvent.load(retry);
    expect(screen.getByRole("heading", { name: "Selo público" })).toBeInTheDocument();
  });

  it("copies Markdown with the real origin and keeps focus on the button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    renderWithMui(<ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />);
    const button = screen.getByRole("button", { name: "Copiar Markdown" });
    button.focus();

    fireEvent.click(button);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `[![Selo Codaqui](${window.location.origin}/badges/membro-teste.svg)](${window.location.origin}/@membro-teste)`,
    ));
    expect(screen.getByRole("status")).toHaveTextContent("Markdown copiado.");
    expect(button).toHaveFocus();
  });

  it("copies HTML with the fixed alternative text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    renderWithMui(<ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar HTML" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `<a href="${window.location.origin}/@membro-teste"><img src="${window.location.origin}/badges/membro-teste.svg" alt="Selo Codaqui"></a>`,
    ));
    expect(screen.getByRole("status")).toHaveTextContent("HTML copiado.");
  });

  it("announces failure when clipboard and fallback are denied", async () => {
    mockClipboard(() => Promise.reject(new Error("denied")));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    renderWithMui(<ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar Markdown" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível copiar/);
    });
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("uses the synchronous fallback and makes repeated announcements distinct", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => true),
    });
    renderWithMui(<ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />);
    const button = screen.getByRole("button", { name: "Copiar Markdown" });
    button.focus();

    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("Markdown copiado.");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Markdown copiado.\u00a0");
    });
    expect(button).toHaveFocus();
  });
});
