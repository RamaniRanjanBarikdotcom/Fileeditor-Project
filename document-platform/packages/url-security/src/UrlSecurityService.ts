import * as dns from 'dns';
import ipaddr from 'ipaddr.js';

export class UrlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlSecurityError';
  }
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

    const hostname = url.hostname;

    // Reject obvious localhost strings before DNS lookup
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.internal')
    ) {
      throw new UrlSecurityError('Access to internal hostnames is forbidden');
    }

    // Resolve DNS
    let addresses: string[] = [];
    try {
      // First try IPv4
      const ipv4Records = await dns.promises.resolve4(hostname);
      addresses.push(...ipv4Records);
    } catch (e: any) {
      if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') {
        throw new UrlSecurityError(`DNS resolution error: ${e.message}`);
      }
    }

    try {
      // Then try IPv6
      const ipv6Records = await dns.promises.resolve6(hostname);
      addresses.push(...ipv6Records);
    } catch (e: any) {
      if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') {
        throw new UrlSecurityError(`DNS resolution error: ${e.message}`);
      }
    }

    if (addresses.length === 0) {
      // It might be an IP address literal already, try parsing it directly
      if (ipaddr.isValid(hostname)) {
        addresses.push(hostname);
      } else {
        throw new UrlSecurityError('Could not resolve hostname');
      }
    }

    for (const address of addresses) {
      try {
        const ip = ipaddr.parse(address);
        const range = ip.range();

        if (range !== 'unicast' && range !== 'ipv4Mapped') {
           throw new UrlSecurityError(`IP address ${address} is in a restricted range (${range})`);
        }
        
        // Block specifically cloud metadata
        if (address === '169.254.169.254') {
           throw new UrlSecurityError(`IP address ${address} is a restricted metadata IP`);
        }
      } catch (e: any) {
        if (e.name === 'UrlSecurityError') throw e;
        console.error('UrlSecurityService unexpected error parsing IP:', e);
        throw new UrlSecurityError(`Invalid IP address resolved: ${address}`);
      }
    }
  }
}
