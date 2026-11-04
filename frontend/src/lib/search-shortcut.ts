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

export function shouldHandleSearchShortcut(event: SearchShortcutEvent): boolean {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  const tagName = event.target.tagName.toUpperCase();
  return (
    !event.target.isContentEditable &&
    tagName !== "INPUT" &&
    tagName !== "TEXTAREA" &&
    tagName !== "SELECT"
  );
}
