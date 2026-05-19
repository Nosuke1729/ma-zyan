import { ALL_KINDS, Tile, TileKind } from './tiles.js';

export type Mode = 'yonma' | 'sanma';

const SANMA_REMOVED = new Set<TileKind>(['2m','3m','4m','5m','6m','7m','8m']);

export function createWall(mode: Mode): Tile[] {
  const tiles: Tile[] = [];

  for (const kind of ALL_KINDS) {
    if (mode === 'sanma' && SANMA_REMOVED.has(kind)) continue;

    for (let copy = 0; copy < 4; copy++) {
      const red = copy === 0 && ['5m', '5p', '5s'].includes(kind);
      tiles.push({ id: `${kind}-${copy}`, kind, red });
    }
  }

  return shuffle(tiles);
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
