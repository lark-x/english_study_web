// The local Web app does not use Cloudflare bindings. These minimal declarations
// keep the optional vinext deployment scaffold type-safe without adding a runtime.
declare module "cloudflare:workers" {
  export const env: { DB?: unknown };
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Database {
  readonly __d1Brand?: never;
}
