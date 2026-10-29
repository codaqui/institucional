import { describe, it, expect } from "vitest";
import { createCodaquiTheme, cqColors } from "./mui-theme";

describe("createCodaquiTheme (Design System v1.0)", () => {
  it("usa cor acionável AA no claro (#378369), não o verde de marca", () => {
    const theme = createCodaquiTheme("light");
    expect(theme.palette.primary.main).toBe("#378369");
    expect(theme.palette.primary.contrastText).toBe("#FFFFFF");
  });

  it("usa primary-300 (#89CBB3) como acionável no escuro", () => {
    const theme = createCodaquiTheme("dark");
    expect(theme.palette.primary.main).toBe("#89CBB3");
    expect(theme.palette.primary.contrastText).toBe(cqColors.primary[900]);
  });

  it("mantém #57B593 disponível apenas como cor de marca (primary 500)", () => {
    expect(cqColors.primary[500]).toBe("#57B593");
  });

  it("secondary é o neutro plum (não o verde claro legado)", () => {
    expect(createCodaquiTheme("light").palette.secondary.main).toBe("#3A2F39");
  });

  it("mantém borderRadius 8 e backgrounds dark do tema atual", () => {
    const dark = createCodaquiTheme("dark");
    expect(dark.shape.borderRadius).toBe(8);
    expect(dark.palette.background.default).toBe("#2A2130");
    expect(dark.palette.background.paper).toBe("#3A2F39");
  });
});
