import { useEffect, useState } from "react";
import { resolveApiUrl } from "../../lib/api-url";

interface Donor {
  id: string;
  githubHandle: string;
  name: string;
  avatarUrl: string;
  totalDonated: number;
  donationCount: number;
}

/**
 * Shape real de GET /members/donors (backend/src/members/members.service.ts
 * → findDonors): paginado, NÃO um array direto.
 */
interface DonorsResponse {
  data?: Donor[];
  total?: number;
  page?: number;
  totalPages?: number;
}

/** Faixa "N pessoas apoiam…" — dados públicos de GET /members/donors. */
export default function SocialProofStrip() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const apiUrl = resolveApiUrl(import.meta.env.SITE);
    fetch(`${apiUrl}/members/donors`)
      .then((res) => (res.ok ? res.json() : null))
      .then((res: DonorsResponse | null) =>
        setCount(res?.total ?? res?.data?.length ?? 0),
      )
      .catch(() => setCount(0));
  }, []);

  if (count === null) {
    return <span className="inline-block h-6 w-64 animate-pulse rounded bg-sunken" />;
  }
  if (count === 0) return null;

  return (
    <p className="text-sm text-text-secondary">
      <strong className="text-text-primary">{count} pessoas</strong> apoiam e
      constroem a Codaqui 💚
    </p>
  );
}
