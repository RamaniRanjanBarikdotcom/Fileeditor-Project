import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import ipaddr from 'ipaddr.js';

export class UrlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlSecurityError';
  }
}

/**
 * Checks whether an IP address is safe for outbound communication
 * (must be global public unicast, not private, loopback, link-local, or cloud metadata).
 */
export function isSafeIp(address: string): boolean {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6') {
      const ipv6 = ip as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) {
        ip = ipv6.toIPv4Address();
      }
    }
    const range = ip.range();
    if (range !== 'unicast') {
      return false;
    }
    // Block AWS/GCP/Azure/DigitalOcean metadata endpoints
    if (address === '169.254.169.254' || address === '100.100.100.200') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe DNS lookup function that validates resolved IPs at connection time
 * to prevent Time-of-Check to Time-of-Use (TOCTOU) DNS-rebinding attacks.
 */
export function safeDnsLookup(
  hostname: string,
  options: dns.LookupOptions | any,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[] | any,
    family?: number,
  ) => void,
): void {
  // Normalize args if options is omitted/is callback
  let actualOptions = options;
  let actualCallback = callback;
  if (typeof options === 'function') {
    actualCallback = options;
    actualOptions = {};
  }

  dns.lookup(hostname, actualOptions, (err, address, family) => {
    if (err) {
      return actualCallback(err, address, family);
    }

    const addressesToCheck: string[] = Array.isArray(address)
      ? address.map((a: any) => (typeof a === 'string' ? a : a.address))
      : [String(address)];

    for (const addr of addressesToCheck) {
      if (!isSafeIp(addr)) {
        const securityErr: any = new Error(
          `DNS rebinding/SSRF prevented: ${hostname} resolved to restricted IP ${addr}`,
        );
        securityErr.code = 'ENOTFOUND';
        return actualCallback(securityErr, address, family);
      }
    }

    actualCallback(null, address, family);
  });
}

/**
 * Creates an HTTP agent configured with safe DNS lookup.
 */
export function createSafeHttpAgent(options?: http.AgentOptions): http.Agent {
  return new http.Agent({
    lookup: safeDnsLookup as any,
    keepAlive: false,
    ...options,
  });
}

/**
 * Creates an HTTPS agent configured with safe DNS lookup.
 */
export function createSafeHttpsAgent(options?: https.AgentOptions): https.Agent {
  return new https.Agent({
    lookup: safeDnsLookup as any,
    keepAlive: false,
    ...options,
  });
}

export class UrlSecurityService {
  /**
   * Validates if a URL is safe to process (not an internal/private IP).
   * Throws a UrlSecurityError if the URL is unsafe.
   */
  async validateUrl(urlString: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      throw new UrlSecurityError('Invalid URL format');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new UrlSecurityError(`Unsupported protocol: ${url.protocol}`);
    }

    if (url.username || url.password) {
      throw new UrlSecurityError('URLs containing embedded credentials are forbidden');
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');

    // Reject obvious localhost strings before DNS lookup
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.internal')
    ) {
      throw new UrlSecurityError('Access to internal hostnames is forbidden');
    }

    // Resolve DNS
    const addresses: string[] = [];
    if (ipaddr.isValid(hostname)) {
      addresses.push(hostname);
    } else {
      try {
        const ipv4Records = await dns.promises.resolve4(hostname);
        addresses.push(...ipv4Records);
      } catch (e: any) {
        if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') {
          throw new UrlSecurityError(`DNS resolution error: ${e.message}`);
        }
      }

      try {
        const ipv6Records = await dns.promises.resolve6(hostname);
        addresses.push(...ipv6Records);
      } catch (e: any) {
        if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') {
          throw new UrlSecurityError(`DNS resolution error: ${e.message}`);
        }
      }
    }

    if (addresses.length === 0) {
      throw new UrlSecurityError('Could not resolve hostname');
    }

    for (const address of addresses) {
      if (!isSafeIp(address)) {
        throw new UrlSecurityError(`IP address ${address} is in a restricted range`);
      }
    }
  }
}
