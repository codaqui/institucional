import { useCallback, useEffect, useState } from "react";

export interface CompanyIdentity {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
}

export type CompanyAuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function useCompanyIdentity({ enabled, authFetch }: {
  enabled: boolean;
  authFetch: CompanyAuthFetch;
}) {
  const [existingCompany, setExistingCompany] = useState<CompanyIdentity | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoadingCompany(true);
    authFetch("/companies/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: CompanyIdentity | null) => {
        if (!active) return;
        setExistingCompany(data);
        if (data) {
          setName(data.name);
          setCnpj(formatCnpj(data.cnpj));
          setLogoUrl(data.logoUrl ?? "");
          setWebsiteUrl(data.websiteUrl ?? "");
        }
      })
      .catch(() => {
        if (active) setFormError("Não foi possível carregar os dados da empresa.");
      })
      .finally(() => {
        if (active) setLoadingCompany(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, authFetch]);

  const registerCompany = useCallback(async (): Promise<CompanyIdentity> => {
    if (!enabled) throw new Error("Cadastro indisponível no momento.");
    if (existingCompany) return existingCompany;

    const rawCnpj = cnpj.replace(/\D/g, "");
    if (rawCnpj.length !== 14) {
      const message = "CNPJ deve ter 14 dígitos.";
      setFormError(message);
      throw new Error(message);
    }
    if (!name.trim()) {
      const message = "Razão social é obrigatória.";
      setFormError(message);
      throw new Error(message);
    }

    setFormError(null);
    const response = await authFetch("/companies", {
      method: "POST",
      body: JSON.stringify({
        cnpj: rawCnpj,
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string };
      const message = body.message ?? "Erro ao cadastrar empresa.";
      setFormError(message);
      throw new Error(message);
    }

    const company = await response.json() as CompanyIdentity;
    setExistingCompany(company);
    return company;
  }, [authFetch, cnpj, enabled, existingCompany, logoUrl, name, websiteUrl]);

  return {
    existingCompany,
    loadingCompany,
    formError,
    cnpj,
    name,
    logoUrl,
    websiteUrl,
    setCnpj,
    setName,
    setLogoUrl,
    setWebsiteUrl,
    setFormError,
    registerCompany,
  };
}
