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

## Full IP report and first-party risk model

The public /tools/ipreport?q=<IP> route consumes /api/ip-report. The homepage /api/ip-risk endpoint extracts the same risk object; there is one scoring model, nodecloak-ip-risk-v2. Source caches are bounded to 256 keys per adapter, coalesced, successful observations cached for five minutes and failed observations for 30 seconds. Each adapter has a 10-second enforced deadline, including stalled body reads; dependent network/Radar work fits below the frontend's 25-second deadline. Underlying routing metadata can retain its established six-hour cache. Current local Tor/DROP snapshots are re-matched on every assessment and expire after 48 hours.

Overall risk weights: DROP70, max(Tor30, proxy25), hosting10, DNSBL abuse25, passive CVE labels10. Optional AbuseIPDB counts over30days add5 for any report,15 for >=5 reports from>=3reporters,30 for>=20 reports from>=5reporters. The total is capped at100; geography, PTR, ASN traffic and subnet estimates do not change it. Missing active evidence returns a null exact score, observed-point lower bound and potential upper bound. Disabled optional sources are excluded and disclosed. CVE labels are passive software-match evidence, not confirmed exploitable vulnerabilities. InternetDB404 is unknown coverage, not a clean scan.

Scenario fit is100 minus its own weighted risk. Weights and factors are in common/ip-report-model.js and visible in each card. Only email uses absent PTR; hosting is normal for email. Country policies are independently versioned, sourced from official product lists, reviewed2026-10-16 and expire after30days. Refresh common/ip-report-policy-data.js monthly from the linked official pages, using current ISO codes; preserve conditional regions and product scope (Gemini web, mainland China Workspace-only). No live platform authentication or delivery tests are implied.

Optional environment keys are listed in hoplens.env.example: CLOUDFLARE_API_KEY (Radar read), PROXYCHECK_API_KEY, ABUSEIPDB_API_KEY and SPAMHAUS_DQS_KEY. Keep them only in root-owned /etc/hoplens.env; never VITE_ variables. proxycheck has a small shared anonymous quota; a configured key raises provider limits. Quota errors remain limited. Spamhaus ZEN is disabled without its DQS key; local DROP remains available. PTR and three public DNSBLs use the server resolver (optional IP_REPORT_DNS_SERVERS override). Every DNSBL requires a healthy positive and negative test before accepting a target NXDOMAIN. Policy-only Spamhaus PBL codes are displayed separately, not scored as generic abuse. Resolver failures stay unknown, with no automatic weakening of DNS checks.

Report URLs include the full queried IP and re-run a current assessment; JSON/TXT exports are generated in the browser from the same response, with timestamps, source states and scoped estimates. Credentials, RDAP contact details and provider-supplied risk scores are never exported. Radar statistics describe seven-day ASN-wide HTTP traffic, not individual-IP activity. Confirm the report, homepage summary, source failure states, local exports and responsive light/dark layout when releasing.
