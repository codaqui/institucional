interface SearchShortcutEvent {
  key: string;
  target: {
    tagName: string;
    isContentEditable?: boolean;
  };
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export function initSearchShortcut(
  document: Document,
  navigate: (path: string) => void,
): void {
  document.addEventListener("keydown", (event) => {
    if (!shouldHandleSearchShortcut(event as unknown as SearchShortcutEvent)) return;
    event.preventDefault();
    if (document.location.pathname === "/busca") {
      document.querySelector<HTMLElement>(".pagefind-ui__search-input")?.focus();
    } else {
      navigate("/busca");
    }
  });
}

export function shouldHandleSearchShortcut(event: SearchShortcutEvent): boolean {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  const tagName = event.target?.tagName?.toUpperCase();
  return (
    !event.target?.isContentEditable &&
    tagName !== "INPUT" &&
    tagName !== "TEXTAREA" &&
    tagName !== "SELECT"
  );
}
