import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanySupportIsland from "../CompanySupportIsland";
import { renderWithMui } from "../../../test/render-mui";

vi.mock("../CompanyDonationIsland", () => ({
  default: () => <div>Fluxo de assinatura mensal</div>,
}));
vi.mock("../CompanyOneTimeDonationIsland", () => ({
  default: () => <div>Fluxo de doação única</div>,
}));

describe("CompanySupportIsland", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/participe/apoiar?modo=empresa");
  });

  it("keeps subscription as the default company journey", () => {
    renderWithMui(<CompanySupportIsland />);

    expect(screen.getByText("Fluxo de assinatura mensal")).toBeInTheDocument();
    expect(screen.queryByText("Fluxo de doação única")).not.toBeInTheDocument();
  });

  it("opens and switches the one-time journey through the URL", async () => {
    window.history.replaceState({}, "", "/participe/apoiar?modo=empresa&apoio=unica");
    const user = userEvent.setup();
    renderWithMui(<CompanySupportIsland />);

    expect(screen.getByText("Fluxo de doação única")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Assinatura mensal" }));
    expect(screen.getByText("Fluxo de assinatura mensal")).toBeInTheDocument();
    expect(window.location.search).toBe("?modo=empresa");

    await user.click(screen.getByRole("button", { name: "Doação única" }));
    expect(window.location.search).toBe("?modo=empresa&apoio=unica");
  });
});
