// Única ilha da página /design-system: envolve um swatch de cor e copia o hex
// ao clicar, com feedback "Copiado!" (aria-live). Renderiza estático (SSR) e
// hidrata com client:visible — sem JS, o swatch continua visível.
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  readonly hex: string;
  readonly children: ReactNode;
}

export default function CopySwatchIsland({ hex, children }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      // Clipboard API indisponível (permissão/contexto inseguro): seleciona
      // como fallback visual — o hex segue legível no próprio swatch.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar código hexadecimal ${hex}`}
      title="Clique para copiar"
      className="relative block w-full cursor-pointer text-left"
    >
      {children}
      <span
        aria-live="polite"
        className={`absolute right-2 bottom-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[0.7rem] font-bold text-white ${
          copied ? "" : "invisible"
        }`}
      >
        Copiado!
      </span>
    </button>
  );
}
