export function turnstileSecret(): string | undefined {
  return (
    process.env.TURNSTILE_SECRET ?? process.env.TURNSTILE_SECRET_KEY
  )?.trim();
}

export function turnstileAllowedHostnames(): Set<string> {
  const configured =
    process.env.TURNSTILE_HOSTNAMES ?? process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '';
  return new Set(
    configured
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
}
