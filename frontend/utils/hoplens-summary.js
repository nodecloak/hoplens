// Derive the live overview from observed diagnostics without inventing privacy scores.
import { isValidIP, isIPv6, isUsablePublicIP } from './valid-ip.js';

export const summarizeDiagnostics = (sections = {}, settled = {}) => {
  const cards = (sections.ipinfo?.cards ?? []).filter((card) => isUsablePublicIP(card?.ip));
  const primary = cards.find((card) => !isIPv6(card.ip)) ?? cards[0] ?? null;
  const ipv6 = cards.find((card) => isIPv6(card.ip)) ?? null;
  const firstByFamily = new Map();
  let routeDifferences = 0;
  for (const card of cards) {
    const family = isIPv6(card.ip) ? 6 : 4;
    if (!firstByFamily.has(family)) firstByFamily.set(family, card.ip);
    else if (firstByFamily.get(family) !== card.ip) routeDifferences++;
  }
  const servers = sections.webrtc?.servers ?? [];
  const rtcIPs = servers.map((server) => server.ip).filter(isValidIP);
  let rtc = settled.WebRTC || servers.length ? 'unavailable' : 'pending';
  if (rtcIPs.length) {
    rtc = rtcIPs.some((ip) => !isUsablePublicIP(ip)) ? 'local'
      : rtcIPs.some((ip) => firstByFamily.has(isIPv6(ip) ? 6 : 4) && firstByFamily.get(isIPv6(ip) ? 6 : 4) !== ip)
        ? 'different' : 'visible';
  }
  const dnsCount = new Set((sections.dnsleak?.providers ?? []).map((provider) => provider.ip).filter(isValidIP)).size;
  const total = 4;
  const completed = ['IPInfo', 'WebRTC', 'DNSLeakTest', 'Connectivity'].filter((key) => settled[key] === true).length;
  return { primary, ipv6, addressCount: cards.length, routeDifferences, rtc, dnsCount, completed, total, percent: Math.round(completed / total * 100) };
};
