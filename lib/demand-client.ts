import { MIN_SAMPLE, cleanTable, matchRole, type DemandTable, type RoleDemand } from "./edge/demand.ts";
import fallback from "./role-demand.json" with { type: "json" };

let loaded: Promise<DemandTable | null> | null = null;

/** The market-demand table committed in lib/role-demand.json (the AI Lodge demo has no edge Worker for a live one). */
export function loadDemand(): Promise<DemandTable | null> {
  loaded ??= Promise.resolve(cleanTable(fallback));
  return loaded;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => { const [, month, day] = iso.split("-"); const name = MONTHS[Number(month) - 1]; return name && Number(day) ? `${Number(day)} ${name}` : ""; };

const usable = (row: RoleDemand | undefined): row is RoleDemand => Boolean(row && row.sample >= MIN_SAMPLE);

/**
 * One plain sentence on how often recent postings carry a skill, or null when the role is not tracked or the sample is too small.
 * Singapore postings come first (the skills employers tagged on MyCareersFuture); the remote job feeds are the fallback. It never changes a score.
 */
export function demandLine(table: DemandTable | null, roleTitle: string, skill: string): string | null {
  const role = table ? matchRole(roleTitle) : null;
  if (!table || !role) return null;
  const sg = table.sg[role];
  const row = usable(sg) ? sg : table.roles[role];
  if (!usable(row)) return null;
  const share = row.skills.find((item) => item.name === skill)?.share ?? 0;
  const when = shortDate(row.updated);
  const where = row === sg ? `recent Singapore ${role} postings on MyCareersFuture` : `recent ${role} postings on free remote job feeds`;
  const dated = `${where}${when ? `, ${when}` : ""}`;
  const verb = row === sg ? "Tagged" : "Named";
  return share > 0 ? `${verb} in ${share}% of ${row.sample} ${dated}.` : `Not ${verb.toLowerCase()} in any of ${row.sample} ${dated}.`;
}

const sgd = (value: number) => "S$" + value.toLocaleString("en-US");

/** The advertised monthly pay for the role in Singapore, in one sentence, or null when there is no range. Postings only, never an offer. */
export function payLine(table: DemandTable | null, roleTitle: string): string | null {
  const role = table ? matchRole(roleTitle) : null;
  const row = role ? table?.sg[role] : undefined;
  if (!row?.pay) return null;
  const when = shortDate(row.updated);
  return `Advertised pay for ${role} in Singapore: ${sgd(row.pay.low)} to ${sgd(row.pay.high)} a month, the middle half of ${row.pay.n} postings (median ${sgd(row.pay.mid)})${when ? `, ${when}` : ""}. Postings only, not an offer.`;
}
