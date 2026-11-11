// Constrain a client-supplied callback URL to the app's own host.
export function constrainCallbackUrl(raw: string, appOrigin: string, pathPrefix: string): URL {
  const app = new URL(appOrigin);
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Invalid callback URL"); }
  if (u.host !== app.host || (u.protocol !== "https:" && u.protocol !== "http:")) throw new Error("Invalid callback URL");
  if (!u.pathname.startsWith(pathPrefix)) throw new Error("Invalid callback URL");
  // Rebuild from trusted origin: only the path is taken from input.
  return new URL(u.pathname, app.origin);
}
