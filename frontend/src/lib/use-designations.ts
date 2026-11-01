import { useCallback, useEffect, useState } from "react";
import { resolveApiUrl } from "./api-url";
import { parseAuthJson } from "./auth-fetch-helpers";
import { useAuth } from "./use-auth";

export type TargetType =
  | "community"
  | "event"
  | "ies"
  | "c4p_campaign"
  | "extension_project"
  | "directorate"
  | "company"
  | "entity"
  | "program";

export type Designation =
  | "responsible"
  | "ambassador"
  | "organizer"
  | "evaluator"
  | "mentor"
  | "director"
  | "maintainer"
  | "manager"
  | "volunteer"
  | "founder";

export interface MyDesignation {
  id: string;
  targetType: TargetType;
  targetId: string | null;
  targetKey: string | null;
  designation: Designation;
}

export function useMyDesignations(): {
  data: MyDesignation[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
} {
  const { authFetch } = useAuth();
  const apiUrl = resolveApiUrl(import.meta.env.SITE);
  const [data, setData] = useState<MyDesignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${apiUrl}/designations/me`);
      const designations = await parseAuthJson<MyDesignation[]>(res, setError);
      if (designations) setData(designations);
    } catch {
      setError("Não foi possível carregar as designações.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
