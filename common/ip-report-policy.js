// Dated official region policies are kept separate from network scores and live access tests.
import { IP_REPORT_POLICIES } from './ip-report-policy-data.js';
import { ALPHA2_TO_NUMERIC } from './country-numeric.js';
const territories={PR:'US',VI:'US',GU:'US',AS:'US',MP:'US',UM:'US',GF:'FR',GP:'FR',MQ:'FR',RE:'FR',YT:'FR',PF:'FR',NC:'FR',PM:'FR',BL:'FR',MF:'FR',WF:'FR',TF:'FR',AW:'NL',CW:'NL',SX:'NL',BQ:'NL',GL:'DK',FO:'DK',AX:'FI'};
export const assessPlatformRegions=(countryCode,now=Date.now())=>Object.entries(IP_REPORT_POLICIES).map(([id,policy])=>{
  const code=typeof countryCode==='string'?countryCode.toUpperCase():null;
  let status='unknown',basis='explicit-list';
  if(code&&(Object.hasOwn(ALPHA2_TO_NUMERIC,code)||code==='XK')) {
    const parent=id==='claude'?territories[code]:null;
    const supported=policy.countries.includes(code)||(parent&&policy.countries.includes(parent));
    if(parent&&!policy.countries.includes(code)) basis='territory-parent';
    status=policy.conditions[code]?'conditional':supported?'supported':'not-listed';
    if(now-Date.parse(policy.reviewedAt)>30*86400000) status='stale';
  }
  return {id,status,basis,condition:policy.conditions[code]??null,source:policy.source,reviewedAt:policy.reviewedAt};
});
