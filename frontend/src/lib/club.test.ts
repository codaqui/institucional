import { describe, expect, it } from "vitest";
import {
  formatClubDate,
  formatCoinLabel,
  pastRaffleStatusLabel,
  raffleActionLabel,
  raffleFilterLabel,
} from "./club";

describe("raffleActionLabel", () => {
  const base = {
    ready: true,
    isLoggedIn: true,
    isFrozen: false,
    canAfford: true,
    entered: false,
    costInCoins: 50,
  };

  it("retorna label neutro enquanto o snapshot de auth não chega (ready=false)", () => {
    // Cobre tanto a pré-hidratação da ClubWalletIsland quanto o fetchMe
    // pendente: o botão fica desabilitado com esse label, então nenhum
    // clique se perde como no-op silencioso.
    expect(raffleActionLabel({ ...base, ready: false })).toBe("Carregando…");
    // ready=false tem precedência sobre todos os demais estados
    expect(
      raffleActionLabel({ ...base, ready: false, isLoggedIn: false }),
    ).toBe("Carregando…");
    expect(
      raffleActionLabel({ ...base, ready: false, isFrozen: true, entered: true }),
    ).toBe("Carregando…");
  });

  it("deslogado (e pronto) → CTA de login", () => {
    expect(raffleActionLabel({ ...base, isLoggedIn: false })).toBe(
      "Entrar com GitHub",
    );
  });

  it("carteira congelada tem precedência sobre saldo/entrada", () => {
    expect(raffleActionLabel({ ...base, isFrozen: true })).toBe(
      "Carteira congelada",
    );
    expect(
      raffleActionLabel({ ...base, isFrozen: true, canAfford: false }),
    ).toBe("Carteira congelada");
  });

  it("saldo insuficiente", () => {
    expect(raffleActionLabel({ ...base, canAfford: false })).toBe(
      "SortCoins insuficientes",
    );
  });

  it("já participando → aumentar participação com o custo", () => {
    expect(raffleActionLabel({ ...base, entered: true })).toBe(
      "Aumentar participação (+50)",
    );
  });

  it("caso padrão → Participar", () => {
    expect(raffleActionLabel(base)).toBe("Participar");
  });
});

describe("formatCoinLabel", () => {
  it("sort_coin vira SortCoin", () => {
    expect(formatCoinLabel("sort_coin")).toBe("SortCoin");
  });

  it("outras moedas são title-cased por palavra", () => {
    expect(formatCoinLabel("mission_coin")).toBe("Mission Coin");
    expect(formatCoinLabel("evento")).toBe("Evento");
  });
});

describe("raffleFilterLabel", () => {
  it("mapeia os três filtros", () => {
    expect(raffleFilterLabel("open")).toBe("Em aberto");
    expect(raffleFilterLabel("past")).toBe("Realizados");
    expect(raffleFilterLabel("all")).toBe("Todos");
  });
});

describe("pastRaffleStatusLabel", () => {
  it("mapeia os status de sorteios encerrados", () => {
    expect(pastRaffleStatusLabel("drawn")).toBe("Sorteado");
    expect(pastRaffleStatusLabel("canceled")).toBe("Cancelado");
    expect(pastRaffleStatusLabel("closed")).toBe("Encerrado");
  });
});

describe("formatClubDate", () => {
  it("formata ISO em pt-BR (dia, mês abreviado, ano)", () => {
    expect(formatClubDate("2026-03-15T12:00:00.000Z")).toMatch(
      /15 de mar\.? de 2026/,
    );
  });
});
