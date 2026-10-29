import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMode(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cq-theme", next);
    setMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="rounded-full p-2 text-text-primary hover:bg-sunken"
    >
      {mode === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
