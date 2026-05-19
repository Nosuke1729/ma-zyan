export type Suit = 'm' | 'p' | 's' | 'z';

export type TileKind =
  | '1m' | '2m' | '3m' | '4m' | '5m' | '6m' | '7m' | '8m' | '9m'
  | '1p' | '2p' | '3p' | '4p' | '5p' | '6p' | '7p' | '8p' | '9p'
  | '1s' | '2s' | '3s' | '4s' | '5s' | '6s' | '7s' | '8s' | '9s'
  | '1z' | '2z' | '3z' | '4z' | '5z' | '6z' | '7z';

export type Tile = {
  id: string;
  kind: TileKind;
  red?: boolean;
};

export const ALL_KINDS: TileKind[] = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  '1z','2z','3z','4z','5z','6z','7z'
];

export function isHonor(kind: TileKind): boolean {
  return kind.endsWith('z');
}

export function isTerminal(kind: TileKind): boolean {
  return kind[0] === '1' || kind[0] === '9';
}

export function isYaochu(kind: TileKind): boolean {
  return isHonor(kind) || isTerminal(kind);
}

export function tileNumber(kind: TileKind): number {
  return Number(kind[0]);
}

export function tileSuit(kind: TileKind): Suit {
  return kind[1] as Suit;
}

export function compareKind(a: TileKind, b: TileKind): number {
  const order: Record<Suit, number> = { m: 0, p: 1, s: 2, z: 3 };
  const suitDiff = order[tileSuit(a)] - order[tileSuit(b)];
  if (suitDiff !== 0) return suitDiff;
  return tileNumber(a) - tileNumber(b);
}
