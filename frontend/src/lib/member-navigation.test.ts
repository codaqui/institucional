import { describe, expect, it } from "vitest";
import {
  buildMemberHref,
  memberSectionFromSearchParams,
} from "./member-navigation";

describe("member navigation", () => {
  it("usa Tudo como filtro inicial de participação", () => {
    expect(memberSectionFromSearchParams("?section=participation")).toEqual({
      section: "participation",
      tab: "all",
    });
  });

  it("lê o filtro interno de eventos", () => {
    expect(
      memberSectionFromSearchParams("?section=participation&tab=events&event=purchased"),
    ).toEqual({ section: "participation", tab: "events", event: "purchased" });
  });

  it.each(["future", "purchased", "history"])(
    "normaliza o deep link legado de eventos: %s",
    (event) => {
      expect(memberSectionFromSearchParams(`?tab=${event}`)).toEqual({
        section: "participation",
        tab: "events",
        event,
      });
    },
  );

  it("normaliza o retorno de compra para eventos futuros", () => {
    expect(memberSectionFromSearchParams("?purchase=success")).toEqual({
      section: "participation",
      tab: "events",
      event: "future",
    });
  });

  it("mantém certificados como filtro de participação", () => {
    expect(
      memberSectionFromSearchParams("?section=participation&tab=certificates"),
    ).toEqual({ section: "participation", tab: "certificates" });
  });

  it("normaliza wallet como alias legado de reembolsos", () => {
    expect(memberSectionFromSearchParams("?tab=wallet")).toEqual({
      section: "finance",
      tab: "reimbursements",
    });
  });

  it("usa Tudo como filtro inicial financeiro", () => {
    expect(memberSectionFromSearchParams("?section=finance")).toEqual({
      section: "finance",
      tab: "all",
    });
  });

  it("cai na visão geral quando a seção é inválida", () => {
    expect(memberSectionFromSearchParams("?section=invalid&tab=certificates")).toEqual({
      section: "overview",
    });
  });

  it("usa fallbacks seguros para filtros inválidos", () => {
    expect(memberSectionFromSearchParams("?section=finance&tab=certificates")).toEqual({
      section: "finance",
      tab: "all",
    });
    expect(
      memberSectionFromSearchParams("?section=participation&tab=events&event=invalid"),
    ).toEqual({ section: "participation", tab: "events", event: "future" });
  });

  it("constrói links canônicos para filtros e eventos", () => {
    expect(buildMemberHref("participation", "certificates")).toBe(
      "?section=participation&tab=certificates",
    );
    expect(buildMemberHref("participation", "events", "purchased")).toBe(
      "?section=participation&tab=events&event=purchased",
    );
    expect(buildMemberHref("finance", "reimbursements")).toBe(
      "?section=finance&tab=reimbursements",
    );
    expect(buildMemberHref("overview")).toBe("?section=overview");
  });
});
