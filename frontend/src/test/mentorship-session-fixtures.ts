import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export async function completeMenteeLinkFlow(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Vincular participante" }));
  const input = await screen.findByRole("combobox", { name: /membro da plataforma/i });
  await user.type(input, "ana");
  await user.click(await screen.findByRole("option", { name: /Ana \(@ana\)/i }));
  await user.click(screen.getByRole("button", { name: "Vincular participante" }));
}
