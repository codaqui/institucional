import React from "react";
import { render, screen } from "@testing-library/react";
import RegistrationConfirmedCard from "..";

describe("RegistrationConfirmedCard", () => {
  it("renderiza o QR Code e o token de check-in da inscrição", () => {
    const { container } = render(
      <RegistrationConfirmedCard checkinToken="token-abc-123" />
    );

    expect(screen.getByText("Inscrição confirmada!")).toBeInTheDocument();
    expect(
      screen.getByText("Apresente o código abaixo no check-in do evento.")
    ).toBeInTheDocument();
    expect(screen.getByText("token-abc-123")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
