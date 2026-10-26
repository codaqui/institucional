/**
 * Tipos compartilhados entre os subcomponentes de /admin/lancamento.
 * Port 1:1 de `src/pages/admin/lancamento.tsx` (Docusaurus).
 */

export interface Account {
  id: string;
  name: string;
  type: string;
  projectKey: string | null;
}

export interface TransferRequest {
  id: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: { name: string; githubHandle: string };
  reviewedBy: { name: string } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  sourceAccount: { name: string };
  destinationAccount: { name: string };
}
