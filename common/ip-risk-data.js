// Public risk snapshot readers; download, locking, publication and scheduling use the shared dataset engine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIp } from './ip-math.js';
import { parseDropSnapshot, parseTorSnapshot, matchRiskSnapshot, isFreshRiskTime } from './ip-risk-score.js';
import logger from './logger.js';

const root=path.dirname(fileURLToPath(import.meta.url));
export const RISK_FEEDS=[
  {id:'tor-exits',file:'exit-addresses.txt',url:'https://check.torproject.org/exit-addresses',parse:parseTorSnapshot,min:100},
  {id:'drop-v4',file:'drop.json',url:'https://www.spamhaus.org/drop/drop_v4.json',parse:text=>parseDropSnapshot(text,4),min:100},
  {id:'drop-v6',file:'drop.json',url:'https://www.spamhaus.org/drop/drop_v6.json',parse:text=>parseDropSnapshot(text,6),min:10},
].map(feed=>({...feed,dir:path.join(root,feed.id+'-db')}));
const snapshots=new Map();
export const readRiskFile = (feed,file) => {
  const snapshot=feed.parse(fs.readFileSync(file,'utf8'));
  if((snapshot.addresses?.size??snapshot.prefixes?.length??0)<feed.min) throw new Error('Risk snapshot below validation floor');
  return snapshot;
};
export const reloadRiskFeed = (id,reason='reload') => {
  const feed=RISK_FEEDS.find(row=>row.id===id);
  try {
    const snapshot=readRiskFile(feed,path.join(feed.dir,feed.file));
    snapshots.set(id,snapshot);
  } catch(error) {
    // Keep a previously validated snapshot; its source timestamp still governs expiry.
    if(error.code!=='ENOENT') logger.warn({dataset:id,reason,code:error.code},'Risk snapshot unavailable');
  }
};
export const isRiskFeedLoaded = id => isFreshRiskTime(snapshots.get(id)?.asOf);
export const getRiskEvidence = ip => ({
  drop:matchRiskSnapshot(snapshots.get(parseIp(ip)?.family===6?'drop-v6':'drop-v4'),ip),
  tor:parseIp(ip)?.family===6?{status:'unsupported'}:matchRiskSnapshot(snapshots.get('tor-exits'),ip),
});
for(const feed of RISK_FEEDS) reloadRiskFeed(feed.id,'startup');
