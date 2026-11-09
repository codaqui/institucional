import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import ProjectCertificateVerificationIsland from "./ProjectCertificateVerificationIsland";

vi.mock("../../../lib/api-url", () => ({ resolveApiUrl: () => "http://api.test" }));

describe("ProjectCertificateVerificationIsland", () => {
  it("verifies a public code and shows only public data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      valid: true, kind: "participant", memberName: "Membro Sintético",
      projectName: "Projeto Sintético", hoursAtIssue: 2, issuedAt: "2026-03-10",
    }));
    renderWithMui(<ProjectCertificateVerificationIsland code="PRJ-1" fetchImpl={fetchImpl} />);

    expect(await screen.findByText("Membro Sintético")).toBeInTheDocument();
    expect(screen.getByText("Projeto Sintético")).toBeInTheDocument();
    expect(screen.getByText(/2 horas/i)).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/project-certificates/verify/PRJ-1");
  });
});
