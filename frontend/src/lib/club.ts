/**
 * Tipos e helpers do Clube Codaqui (port de src/pages/clube.tsx do Docusaurus).
 *
 * No original a página era um único componente React; no Astro ela vira um
 * shell estático + duas ilhas que se comunicam via CustomEvents no `window`:
 *
 * - CLUB_WALLET_STATE_EVENT — ClubWalletIsland → ClubRafflesIsland: snapshot
 *   de auth/carteira/entries (publicado a cada mudança e sempre que a ilha de
 *   sorteios anuncia presença — ela hidrata depois, com client:visible).
 * - CLUB_RAFFLES_READY_EVENT — ClubRafflesIsland → ClubWalletIsland: pedido de
 *   re-publicação do snapshot.
 * - CLUB_ENTER_RAFFLE_EVENT — ClubRafflesIsland → ClubWalletIsland: pedido de
 *   participação (a ilha de carteira decide: login se deslogado, senão
 *   POST /club/raffles/:id/enter).
 * - CLUB_RAFFLE_ENTERED_EVENT — ClubWalletIsland → ClubRafflesIsland: entrada
 *   confirmada; a ilha de sorteios re-busca as stats do sorteio.
 */

export interface ClubRaffle {
  id: string;
  title: string;
  description: string | null;
  costInCoins: number;
  status: string;
  closesAt: string;
}

export interface ClubPastRaffle {
  id: string;
  title: string;
  status: "closed" | "drawn" | "canceled";
  closesAt: string;
  drawAt: string | null;
  winnerDisplay: string | null;
  totalCoinsGenerated: number;
  drawSeed: string | null;
  drawAlgorithm: string | null;
  algorithmCodeUrl: string;
}

export interface ClubWallet {
  id: string;
  balances: Record<string, number>;
  frozenTypes: string[];
}

export interface ClubRaffleStats {
  participantCount: number;
  totalCoins: number;
}

export interface ClubMyRaffleEntry {
  raffleId: string;
  coinsSpent: number;
}

/** Snapshot de auth/carteira publicado pela ClubWalletIsland. */
export interface ClubWalletState {
  ready: boolean;
  isLoggedIn: boolean;
  sortCoins: number;
  isFrozen: boolean;
  enteredRaffleIds: string[];
  myCoinsByRaffle: Record<string, number>;
  enteringRaffleId: string | null;
}

export const CLUB_WALLET_STATE_EVENT = "codaqui:club-wallet-state";
export const CLUB_RAFFLES_READY_EVENT = "codaqui:club-raffles-ready";
export const CLUB_ENTER_RAFFLE_EVENT = "codaqui:club-enter-raffle";
export const CLUB_RAFFLE_ENTERED_EVENT = "codaqui:club-raffle-entered";

export const CLUB_INITIAL_WALLET_STATE: ClubWalletState = {
  ready: false,
  isLoggedIn: false,
  sortCoins: 0,
  isFrozen: false,
  enteredRaffleIds: [],
  myCoinsByRaffle: {},
  enteringRaffleId: null,
};

export function publishClubWalletState(state: ClubWalletState): void {
  globalThis.dispatchEvent(
    new CustomEvent(CLUB_WALLET_STATE_EVENT, { detail: state }),
  );
}

export function announceClubRafflesReady(): void {
  globalThis.dispatchEvent(new CustomEvent(CLUB_RAFFLES_READY_EVENT));
}

export function requestEnterRaffle(raffleId: string, costInCoins: number): void {
  globalThis.dispatchEvent(
    new CustomEvent(CLUB_ENTER_RAFFLE_EVENT, {
      detail: { raffleId, costInCoins },
    }),
  );
}

export function notifyRaffleEntered(raffleId: string): void {
  globalThis.dispatchEvent(
    new CustomEvent(CLUB_RAFFLE_ENTERED_EVENT, { detail: { raffleId } }),
  );
}

export function formatClubDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCoinLabel(coinType: string): string {
  if (coinType === "sort_coin") return "SortCoin";
  return coinType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function raffleFilterLabel(filter: "open" | "past" | "all"): string {
  if (filter === "open") return "Em aberto";
  if (filter === "past") return "Realizados";
  return "Todos";
}

export function raffleActionLabel(args: {
  ready: boolean;
  isLoggedIn: boolean;
  isFrozen: boolean;
  canAfford: boolean;
  entered: boolean;
  costInCoins: number;
}): string {
  // Enquanto o snapshot de auth não chega (ilha de carteira não hidratou ou
  // fetchMe pendente), o botão fica desabilitado com label neutro — assim
  // nenhum clique se perde (no-op silencioso) e há feedback visual.
  if (!args.ready) return "Carregando…";
  if (args.isLoggedIn === false) return "Entrar com GitHub";
  if (args.isFrozen) return "Carteira congelada";
  if (args.canAfford === false) return "SortCoins insuficientes";
  if (args.entered) return `Aumentar participação (+${args.costInCoins})`;
  return "Participar";
}

export function pastRaffleStatusLabel(status: ClubPastRaffle["status"]): string {
  if (status === "drawn") return "Sorteado";
  if (status === "canceled") return "Cancelado";
  return "Encerrado";
}
