// Optional DNS override. When the local network's resolver (e.g. an ISP router) fails
// to resolve MongoDB Atlas — `querySrv ECONNREFUSED` on `mongodb+srv://`, or no A record
// for the shard hosts — this routes the app's DNS through a public resolver (default
// 8.8.8.8 / 1.1.1.1) without touching system network settings.
//
// This module is imported BEFORE anything connects, which is also before env.js runs —
// so it loads the .env itself here. It auto-enables when MONGODB_URI is an Atlas SRV URI
// (the case that needs it); force on/off with FORCE_PUBLIC_DNS=true|false.

import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load the same .env files env.js does, so our flags are populated before we read them.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Blog-generator/.env
dotenv.config(); // cwd .env (backend/.env)

const serversEnv = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const force = String(process.env.FORCE_PUBLIC_DNS || '').toLowerCase();
const usesSrv = /^mongodb\+srv:\/\//i.test(process.env.MONGODB_URI || '');
// On unless explicitly disabled; default-on for Atlas SRV URIs or when DNS_SERVERS is set.
const enabled =
  force === 'true' ||
  (force !== 'false' && (usesSrv || !!process.env.DNS_SERVERS));

if (enabled && serversEnv.length > 0) {
  try {
    // Fixes c-ares lookups: resolveSrv / resolveTxt (the SRV part of mongodb+srv).
    dns.setServers(serversEnv);
  } catch (err) {
    console.warn('[dns] setServers failed:', err.message);
  }

  // The hostname → IP step for actual connections uses dns.lookup() (the OS resolver),
  // which does NOT honour setServers(). Patch it to resolve via c-ares (which does),
  // while leaving IP literals / localhost / unresolvable internal names to the original.
  const originalLookup = dns.lookup.bind(dns);
  const isLiteralOrLocal = (h) => !h || net.isIP(h) !== 0 || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local');

  dns.lookup = function patchedLookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const opts = options || {};
    if (isLiteralOrLocal(hostname)) return originalLookup(hostname, opts, callback);

    dns.resolve4(hostname, (err, addrs) => {
      if (!err && addrs && addrs.length) {
        if (opts.all) return callback(null, addrs.map((address) => ({ address, family: 4 })));
        return callback(null, addrs[0], 4);
      }
      dns.resolve6(hostname, (err6, addrs6) => {
        if (!err6 && addrs6 && addrs6.length) {
          if (opts.all) return callback(null, addrs6.map((address) => ({ address, family: 6 })));
          return callback(null, addrs6[0], 6);
        }
        // Fall back to the OS resolver so internal/Docker names never hard-fail.
        return originalLookup(hostname, opts, callback);
      });
    });
  };

  console.log('[dns] routing DNS through', serversEnv.join(', '));
}
