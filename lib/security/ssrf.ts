import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Sellers give us a URL that OUR servers will fetch. Without a guard that is a server-side request
 * forgery hole (cloud metadata, localhost admin ports, internal services). This blocks non-public targets.
 */

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local + cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224 // multicast / reserved
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb")) return true; // link-local
    if (x.startsWith("fc") || x.startsWith("fd")) return true; // unique local
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // not an IP at all: treat as unsafe
}

export class UnsafeUpstreamError extends Error {}

export interface GuardOptions {
  /** allow http:// and private targets (local development only) */
  allowPrivate?: boolean;
}

export function guardOptionsFromEnv(): GuardOptions {
  return { allowPrivate: process.env.ALLOW_PRIVATE_UPSTREAMS === "1" && process.env.NODE_ENV !== "production" };
}

/** Throws UnsafeUpstreamError unless the URL is https and resolves only to public addresses. */
export async function assertPublicUrl(raw: string, opts: GuardOptions = guardOptionsFromEnv()): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUpstreamError("Upstream URL is not a valid URL");
  }
  if (url.username || url.password) throw new UnsafeUpstreamError("Credentials in the URL are not allowed; use a header secret");
  if (!opts.allowPrivate && url.protocol !== "https:") throw new UnsafeUpstreamError("Upstream URL must be https");
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUpstreamError("Unsupported URL scheme");
  if (opts.allowPrivate) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUpstreamError("Upstream host is not public");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new UnsafeUpstreamError("Upstream host does not resolve");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUpstreamError("Upstream resolves to a non-public address");
  return url;
}
