/** URL base da API NestJS. Em dev: http://localhost:3001 (compose). */
export const API_URL: string =
  import.meta.env.PUBLIC_API_URL ?? "http://localhost:3001";
