import { BASE_PATH } from "./base-path";

/**
 * Wrapper de `fetch` para chamadas à própria API do app.
 * Prefixa automaticamente com BASE_PATH (ex: "/sistema") — necessário
 * porque o app roda atrás de um reverse proxy sob um subpath, e chamadas
 * `fetch()` cruas não herdam o `basePath` do Next.js como `<Link>` herda.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_PATH}${path}`, init);
}
