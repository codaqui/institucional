// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  closeSiblingDetails,
  closeAllDetails,
  isOutside,
  initHeaderDetailsNav,
  focusableIn,
  nextTrapTarget,
} from "./header-menu";

function headerWithMenus(): HTMLElement {
  document.body.innerHTML = `
    <header id="h">
      <details id="d1"><summary>Sobre</summary><ul><li><a href="/a">A</a></li></ul></details>
      <details id="d2"><summary>Participe</summary><ul><li><a href="/b">B</a></li></ul></details>
      <details id="d3"><summary>Trilhas</summary><ul><li><a href="/c">C</a></li></ul></details>
    </header>
    <main id="conteudo"><p>Fora do header</p></main>
  `;
  return document.getElementById("h") as HTMLElement;
}

const open = (id: string) => {
  const el = document.getElementById(id) as HTMLDetailsElement;
  el.setAttribute("open", "");
  return el;
};

describe("closeSiblingDetails (single-open)", () => {
  it("fecha os demais <details> do header e mantém o atual", () => {
    const header = headerWithMenus();
    open("d1");
    open("d2");
    const d3 = open("d3");
    closeSiblingDetails(header, d3);
    expect(document.getElementById("d1")!.hasAttribute("open")).toBe(false);
    expect(document.getElementById("d2")!.hasAttribute("open")).toBe(false);
    expect(d3.hasAttribute("open")).toBe(true);
  });

  it("sem outros abertos não altera nada", () => {
    const header = headerWithMenus();
    const d2 = open("d2");
    closeSiblingDetails(header, d2);
    expect(d2.hasAttribute("open")).toBe(true);
  });
});

describe("closeAllDetails (ESC / clique fora)", () => {
  it("fecha todos os <details> abertos do header", () => {
    headerWithMenus();
    open("d1");
    open("d3");
    closeAllDetails(document.getElementById("h")!);
    expect(document.querySelectorAll("details[open]")).toHaveLength(0);
  });
});

describe("isOutside", () => {
  it("true quando o alvo está fora do header", () => {
    const header = headerWithMenus();
    const fora = document.querySelector("main p")!;
    expect(isOutside(fora, header)).toBe(true);
  });

  it("false quando o alvo está dentro do header", () => {
    const header = headerWithMenus();
    const summary = document.querySelector("#d1 summary")!;
    expect(isOutside(summary, header)).toBe(false);
  });
});

describe("initHeaderDetailsNav", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("abrir um menu fecha o outro (single-open)", () => {
    const header = headerWithMenus();
    initHeaderDetailsNav(header);
    const d1 = open("d1");
    // o browser dispara `toggle` ao mudar open — simula o evento
    d1.dispatchEvent(new Event("toggle"));
    const d2 = open("d2");
    d2.dispatchEvent(new Event("toggle"));
    expect(d1.hasAttribute("open")).toBe(false);
    expect(d2.hasAttribute("open")).toBe(true);
  });

  it("evento toggle sem open (fechando) não fecha os demais", () => {
    const header = headerWithMenus();
    initHeaderDetailsNav(header);
    const d1 = open("d1");
    d1.dispatchEvent(new Event("toggle"));
    const d2 = open("d2");
    d2.dispatchEvent(new Event("toggle"));
    // fecha d2 → toggle sem open: d1 continua fechado, d2 fecha, sem erro
    d2.removeAttribute("open");
    d2.dispatchEvent(new Event("toggle"));
    expect(d2.hasAttribute("open")).toBe(false);
  });

  it("clique fora do header fecha os menus abertos", () => {
    const header = headerWithMenus();
    initHeaderDetailsNav(header);
    const d1 = open("d1");
    d1.dispatchEvent(new Event("toggle"));
    document.querySelector("main p")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(d1.hasAttribute("open")).toBe(false);
  });

  it("clique dentro do header não fecha o menu aberto", () => {
    const header = headerWithMenus();
    initHeaderDetailsNav(header);
    const d1 = open("d1");
    d1.dispatchEvent(new Event("toggle"));
    // clica no link dentro do painel aberto (summary alternaria o details
    // nativamente — fora do escopo do helper)
    document.querySelector("#d1 a")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(d1.hasAttribute("open")).toBe(true);
  });

  it("ESC fecha os menus abertos", () => {
    const header = headerWithMenus();
    initHeaderDetailsNav(header);
    const d1 = open("d1");
    d1.dispatchEvent(new Event("toggle"));
    const d3 = open("d3");
    d3.dispatchEvent(new Event("toggle"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelectorAll("details[open]")).toHaveLength(0);
  });
});

describe("focusableIn / nextTrapTarget (focus trap do drawer)", () => {
  it("lista focáveis em tab order, ignorando disabled e tabindex=-1", () => {
    document.body.innerHTML = `
      <div id="panel" tabindex="-1">
        <a href="/x">X</a>
        <button disabled>off</button>
        <button id="b1">ok</button>
        <span tabindex="-1">skip</span>
      </div>
    `;
    const panel = document.getElementById("panel") as HTMLElement;
    const list = focusableIn(panel);
    expect(list.map((el) => el.id || el.textContent)).toEqual(["X", "b1"]);
  });

  it("Tab no último enrola para o primeiro", () => {
    const a = document.createElement("a");
    const b = document.createElement("button");
    expect(nextTrapTarget([a, b], b, false)).toBe(a);
  });

  it("Shift+Tab no primeiro enrola para o último", () => {
    const a = document.createElement("a");
    const b = document.createElement("button");
    expect(nextTrapTarget([a, b], a, true)).toBe(b);
  });

  it("no meio da lista devolve null (tab order nativo)", () => {
    const a = document.createElement("a");
    const b = document.createElement("button");
    const c = document.createElement("a");
    expect(nextTrapTarget([a, b, c], b, false)).toBeNull();
    expect(nextTrapTarget([a, b, c], b, true)).toBeNull();
  });

  it("foco fora da lista vai para o primeiro elemento", () => {
    const a = document.createElement("a");
    expect(nextTrapTarget([a], null, false)).toBe(a);
  });
});
