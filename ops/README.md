<!-- Hoplens production deployment and rollback runbook. -->
# Hoplens operations

Production: https://ip.nodecloak.com · API: `127.0.0.1:11967`.

## Layout

- `/srv/hoplens/releases/<commit>/`: immutable source, dependencies and `dist/`.
- `/srv/hoplens/current`: atomic symlink to the active release.
- `/var/lib/hoplens/<name>-db/`: persistent offline datasets; each release links its `common/*-db/` directories here.
- `/opt/hoplens/node-v24.22.0-linux-x64/`: dedicated Node LTS runtime, verified against the official HTTPS `SHASUMS256.txt`. System Node is unchanged.
- `/etc/hoplens.env`: root-owned runtime settings based on `hoplens.env.example`. Never commit live credentials.
- `/etc/systemd/system/hoplens.service` and `/etc/nginx/sites-available/ip.nodecloak.com`: isolated service and vhost.

## Build and release

1. Run `corepack pnpm install --frozen-lockfile` and `corepack pnpm check` on Node 24.15 or newer. Build with `VITE_SITE_URL=https://ip.nodecloak.com`; leave optional analytics, Firebase, Sentry, docs assistant and report-storage credentials unset unless intentionally configured.
2. Archive the reviewed Git commit plus `dist/`; upload it over SSH using a separately verified server host key. Extract into a new release directory. Keep old releases for rollback.
3. Install runtime dependencies with the dedicated Node runtime on PATH: `corepack pnpm install --prod --frozen-lockfile`. The committed pnpm allowlist controls install scripts. Link `common/maxmind-db`, `common/as-org-db`, `common/as-rel-db`, `common/peeringdb-db`, and `common/oui-db` to the corresponding persistent directories, owned by `hoplens`. Release code stays root-owned and world-readable.
4. First deployment only: install the service/environment files; fetch and validate Cloudflare's official IP ranges from `https://api.cloudflare.com/client/v4/ips` into `hoplens-realip.conf` (`set_real_ip_from <CIDR>;` and `real_ip_header CF-Connecting-IP;`). Do not trust arbitrary forwarded headers. Install an HTTP ACME vhost, issue a Let's Encrypt webroot certificate for `ip.nodecloak.com`, then install `nginx.conf`.
5. Record the previous symlink target, create `current.next`, then `mv -Tf /srv/hoplens/current.next /srv/hoplens/current`. Restart `hoplens`, run `nginx -t`, and reload nginx.
6. Check HTTPS, `/api/configs` with a same-origin Referer, rejection of foreign Referers and private-IP queries, a public-IP lookup, DNS resolution, a standalone tool route, and a browser full check. Confirm existing NodeCloak health still returns OK. After a reload, allow nginx's new workers to take over before probing the new vhost or certificate.

## Rollback and maintenance

Point `current.next` at the recorded previous release, atomically replace `current`, and restart `hoplens`. Datasets remain in place. Inspect `systemctl status hoplens` and `journalctl -u hoplens` for failures; HTTP access logging is off. Certificate renewal uses certbot's system timer and webroot challenge; its deploy hook must reload nginx. Periodically refresh Cloudflare's official trusted-IP ranges.

IP/DNS/STUN/speed/geolocation providers have their own availability and policies. Failed probes remain unavailable; they are never presented as a clean privacy result. Optional paid/upstream-only integrations remain gated when their credentials are absent.
