import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
    };
  }
}

async function renderField(onTokenChange: (token: string) => void) {
  const { default: TurnstileField } = await import("./TurnstileField");
  return render(<TurnstileField onTokenChange={onTokenChange} />);
}

function installTurnstile() {
  const renderWidget = vi.fn((_container: HTMLElement, options: TurnstileOptions) => {
    options.callback("verified-token");
    return "widget-id";
  });
  window.turnstile = { render: renderWidget, remove: vi.fn() };
  return renderWidget;
}

describe("TurnstileField", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DEV", true);
    vi.stubEnv("PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    document.head.querySelectorAll(`script[src="${SCRIPT_URL}"]`).forEach((script) => script.remove());
    Reflect.deleteProperty(window, "turnstile");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, "turnstile");
  });

  it("loads the official script once and returns the widget token", async () => {
    const firstTokenChange = vi.fn();
    const secondTokenChange = vi.fn();
    await renderField(firstTokenChange);
    await renderField(secondTokenChange);

    const scripts = document.head.querySelectorAll<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute("async");
    expect(scripts[0]).toHaveAttribute("defer");
    const renderWidget = installTurnstile();
    await act(async () => {
      scripts[0].dispatchEvent(new Event("load"));
    });

    await waitFor(() => expect(firstTokenChange).toHaveBeenCalledWith("verified-token"));
    expect(secondTokenChange).toHaveBeenCalledWith("verified-token");
    expect(renderWidget).toHaveBeenCalledTimes(2);
    expect(renderWidget.mock.calls[0][1].sitekey).toBe("test-site-key");
  });

  it("shows an unavailable state when the official script fails", async () => {
    const onTokenChange = vi.fn();
    await renderField(onTokenChange);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    expect(script).not.toBeNull();

    await act(async () => {
      script?.dispatchEvent(new Event("error"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verificação de segurança indisponível",
    );
    expect(onTokenChange).toHaveBeenCalledWith("");
  });

  it("clears the token and exposes an error when the widget expires", async () => {
    const onTokenChange = vi.fn();
    await renderField(onTokenChange);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const renderWidget = vi.fn((_container: HTMLElement, _options: TurnstileOptions) => "widget-id");
    window.turnstile = { render: renderWidget, remove: vi.fn() };
    await act(async () => {
      script?.dispatchEvent(new Event("load"));
    });
    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    const options = renderWidget.mock.calls[0][1] as TurnstileOptions;

    act(() => options["expired-callback"]());

    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("alert")).toHaveTextContent("Verificação de segurança expirada");
  });

  it("uses a development-only token without a site key", async () => {
    vi.stubEnv("PUBLIC_TURNSTILE_SITE_KEY", "");
    const onTokenChange = vi.fn();

    await renderField(onTokenChange);

    expect(screen.getByRole("alert")).toHaveTextContent("Turnstile não configurado");
    expect(document.head.querySelector(`script[src="${SCRIPT_URL}"]`)).toBeNull();
    expect(onTokenChange).toHaveBeenCalledWith("development");
  });

  it("renders no widget or success state without a site key in production", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("PUBLIC_TURNSTILE_SITE_KEY", "");
    const onTokenChange = vi.fn();

    const { container } = await renderField(onTokenChange);

    expect(container).toBeEmptyDOMElement();
    expect(document.head.querySelector(`script[src="${SCRIPT_URL}"]`)).toBeNull();
    expect(onTokenChange).not.toHaveBeenCalled();
  });
});
