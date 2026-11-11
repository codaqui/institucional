import { describe, expect, it } from "vitest";
import {
  buildMemberHref,
  memberSectionFromSearchParams,
} from "./member-navigation";

describe("member navigation", () => {
  it("lê seção e subaba de participação", () => {
    expect(
      memberSectionFromSearchParams("?section=participation&tab=certificates"),
    ).toEqual({ section: "participation", tab: "certificates" });
  });

  it("cai na visão geral quando a seção é inválida", () => {
    expect(memberSectionFromSearchParams("?section=invalid&tab=certificates")).toEqual({
      section: "overview",
    });
  });

  it("normaliza o deep link legado de eventos futuros", () => {
    expect(memberSectionFromSearchParams("?tab=future")).toEqual({
      section: "participation",
      tab: "future",
    });
  });

  it("normaliza o retorno de compra sem perder o destino", () => {
    expect(memberSectionFromSearchParams("?purchase=success")).toEqual({
      section: "participation",
      tab: "future",
    });
  });

  it("descarta uma subaba que não pertence à seção", () => {
    expect(memberSectionFromSearchParams("?section=finance&tab=certificates")).toEqual({
      section: "finance",
    });
  });

  it("constrói links estáveis para as seções", () => {
    expect(buildMemberHref("participation", "certificates")).toBe(
      "?section=participation&tab=certificates",
    );
    expect(buildMemberHref("overview")).toBe("?section=overview");
  });
});
