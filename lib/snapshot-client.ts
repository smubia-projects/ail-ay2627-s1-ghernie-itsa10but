import { cleanSnapshot, sgDate, type SnapshotDoc } from "./edge/snapshot.ts";

let loaded: Promise<SnapshotDoc | null> | null = null;

/** The Worker's latest daily check. The AI Lodge demo has no edge Worker, so this is null and the page keeps its built-in date and list. */
export function loadSnapshot(): Promise<SnapshotDoc | null> {
  loaded ??= Promise.resolve(cleanSnapshot(null));
  return loaded;
}

export const checkedLabel = (doc: SnapshotDoc | null, fallback: string) => (doc ? sgDate(doc.checked) : fallback);
