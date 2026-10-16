<!-- IP.NodeCloak production deployment and rollback runbook. -->
# IP.NodeCloak operations

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
3. Install runtime dependencies with the dedicated Node runtime on PATH: `corepack pnpm install --prod --frozen-lockfile`. The committed pnpm allowlist controls install scripts. Link `common/maxmind-db`, `common/as-org-db`, `common/as-rel-db`, `common/peeringdb-db`, `common/oui-db`, `common/tor-exits-db`, `common/drop-v4-db`, and `common/drop-v6-db` to the corresponding persistent directories, owned by `hoplens`. Release code stays root-owned and world-readable.
4. First deployment only: install the service/environment files; fetch and validate Cloudflare's official IP ranges from `https://api.cloudflare.com/client/v4/ips` into `hoplens-realip.conf` (`set_real_ip_from <CIDR>;` and `real_ip_header CF-Connecting-IP;`). Do not trust arbitrary forwarded headers. Install an HTTP ACME vhost, issue a Let's Encrypt webroot certificate for `ip.nodecloak.com`, then install `nginx.conf`.
5. Record the previous symlink target, create `current.next`, then `mv -Tf /srv/hoplens/current.next /srv/hoplens/current`. Restart `hoplens`, run `nginx -t`, and reload nginx.
6. Check HTTPS, `/api/configs` with a same-origin Referer, rejection of foreign Referers and private-IP queries, a public-IP lookup, DNS resolution, a standalone tool route, and a browser full check. Confirm existing NodeCloak health still returns OK. After a reload, allow nginx's new workers to take over before probing the new vhost or certificate.

## Rollback and maintenance

Point `current.next` at the recorded previous release, atomically replace `current`, and restart `hoplens`. Datasets remain in place. Inspect `systemctl status hoplens` and `journalctl -u hoplens` for failures; HTTP access logging is off. Certificate renewal uses certbot's system timer and webroot challenge; its deploy hook must reload nginx. Periodically refresh Cloudflare's official trusted-IP ranges.

IP/DNS/STUN/speed/geolocation providers have their own availability and policies. Failed probes remain unavailable; they are never presented as a clean privacy result. Optional paid/upstream-only integrations remain gated when their credentials are absent.

## Homepage IP details

The expanded homepage panel queries RIPEstat for the selected IP's BGP prefix and origin ASN, and IPWhois for network/domain/location metadata. The ASN's name uses the local CAIDA table where available. Other configured geolocation sources look up that same IP; Cloudflare trace is included only when its caller IP matches, and supplies country only. Metadata is cached by queried IP; incomplete responses have a shorter TTL. IP-API's explicit hosting/mobile/proxy flags are retained without inferring residential status from missing flags.

Cloudflare Radar human/bot percentages require `CLOUDFLARE_API_KEY` and describe ASN-wide HTTP traffic over seven days, not individual-IP activity. With no key, the panel shows the source state and an ASN report link.

## First-party IP risk model

`/api/ip-risk` returns `nodecloak-ip-risk-v1`, a transparent heuristic index, not a fraud probability or an individual user's behavior assessment. Higher scores mean more observed signals. The disclosed weights are: Spamhaus DROP match 70, Tor observed exit 30, IP-API proxy marker 25, IP-API hosting marker 10. Tor/proxy are one category (maximum weight, never double counted); total capped at 100. Only four current, explicit observations produce an exact number, including an honest zero. Incomplete evidence returns `score: null`, coverage and each rule's state. Hosting/proxy/Tor describe network characteristics. Geography, country and inferred residential status never add points.

Tor's observed IPv4 exits and Spamhaus DROP IPv4/IPv6 snapshots use rows in the existing dataset updater, atomic publication and the shared daily scheduler. Snapshots older than 48 hours remain unknown; the current Tor source does not establish IPv6 absence. Raw date/copyright metadata is retained, and Spamhaus Project credit appears with the evidence. The DROP source is downloaded daily, not per visitor. IP-API classification is same-IP validated and cached in memory for five minutes; matching against the current local snapshots happens on every assessment. No queried IP is sent to the snapshot providers. Privacy packs disclose IP-API requests and bounded caching.
