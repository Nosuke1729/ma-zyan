import { TileKind, compareKind, isHonor, tileNumber, tileSuit } from './tiles.js';

export type MeldShape =
  | { type: 'sequence'; tiles: TileKind[] }
  | { type: 'triplet'; tiles: TileKind[] };

export type AgariShape =
  | { type: 'standard'; pair: TileKind; melds: MeldShape[] }
  | { type: 'chiitoi'; pairs: TileKind[] }
  | { type: 'kokushi' };

const KOKUSHI_KINDS: TileKind[] = [
  '1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'
];

export function countKinds(kinds: TileKind[]): Map<TileKind, number> {
  const map = new Map<TileKind, number>();
  for (const kind of kinds) map.set(kind, (map.get(kind) ?? 0) + 1);
  return map;
}

export function findAgariShapes(kinds: TileKind[]): AgariShape[] {
  const sorted = [...kinds].sort(compareKind);
  if (sorted.length % 3 !== 2) return [];

  const result: AgariShape[] = [];
  if (isChiitoi(sorted)) result.push({ type: 'chiitoi', pairs: [...countKinds(sorted).keys()] });
  if (isKokushi(sorted)) result.push({ type: 'kokushi' });
  result.push(...findStandardShapes(sorted));
  return result;
}

export function isAgari(kinds: TileKind[]): boolean {
  return findAgariShapes(kinds).length > 0;
}

function isChiitoi(kinds: TileKind[]): boolean {
  if (kinds.length !== 14) return false;
  const counts = countKinds(kinds);
  return counts.size === 7 && [...counts.values()].every(v => v === 2);
}

function isKokushi(kinds: TileKind[]): boolean {
  if (kinds.length !== 14) return false;
  const counts = countKinds(kinds);
  return KOKUSHI_KINDS.every(k => (counts.get(k) ?? 0) >= 1)
    && KOKUSHI_KINDS.some(k => (counts.get(k) ?? 0) >= 2);
}

function findStandardShapes(kinds: TileKind[]): AgariShape[] {
  const counts = countKinds(kinds);
  const result: AgariShape[] = [];

  for (const [pair, n] of counts.entries()) {
    if (n < 2) continue;
    const next = new Map(counts);
    next.set(pair, n - 2);
    searchMelds(next, [], melds => result.push({ type: 'standard', pair, melds }));
  }

  return result;
}

function searchMelds(
  counts: Map<TileKind, number>,
  melds: MeldShape[],
  done: (melds: MeldShape[]) => void,
) {
  const first = [...counts.entries()].find(([, n]) => n > 0)?.[0];
  if (!first) {
    done([...melds]);
    return;
  }

  const n = counts.get(first) ?? 0;

  if (n >= 3) {
    counts.set(first, n - 3);
    melds.push({ type: 'triplet', tiles: [first, first, first] });
    searchMelds(counts, melds, done);
    melds.pop();
    counts.set(first, n);
  }

  if (!isHonor(first)) {
    const suit = tileSuit(first);
    const num = tileNumber(first);
    if (num <= 7) {
      const b = `${num + 1}${suit}` as TileKind;
      const c = `${num + 2}${suit}` as TileKind;
      const nb = counts.get(b) ?? 0;
      const nc = counts.get(c) ?? 0;
      if (nb > 0 && nc > 0) {
        counts.set(first, n - 1);
        counts.set(b, nb - 1);
        counts.set(c, nc - 1);
        melds.push({ type: 'sequence', tiles: [first, b, c] });
        searchMelds(counts, melds, done);
        melds.pop();
        counts.set(first, n);
        counts.set(b, nb);
        counts.set(c, nc);
      }
    }
  }
}
