import { Tile, TileKind, tileNumber, tileSuit } from './tiles.js';

export type DoraCount = {
  doraHan: number;
  redDoraHan: number;
  uraDoraHan: number;
  totalDoraHan: number;
};

export function nextDoraKind(indicator: TileKind): TileKind {
  if (indicator.endsWith('z')) {
    const order: TileKind[] = ['1z', '2z', '3z', '4z'];
    const dragons: TileKind[] = ['5z', '6z', '7z'];
    if (order.includes(indicator)) {
      return order[(order.indexOf(indicator) + 1) % order.length];
    }
    return dragons[(dragons.indexOf(indicator) + 1) % dragons.length];
  }

  const suit = tileSuit(indicator);
  const nextNumber = tileNumber(indicator) === 9 ? 1 : tileNumber(indicator) + 1;
  return `${nextNumber}${suit}` as TileKind;
}

export function countDora(
  tiles: Tile[],
  doraIndicators: Tile[],
  uraDoraIndicators: Tile[],
  includeUra: boolean,
): DoraCount {
  const doraKinds = doraIndicators.map(tile => nextDoraKind(tile.kind));
  const uraKinds = includeUra ? uraDoraIndicators.map(tile => nextDoraKind(tile.kind)) : [];

  let doraHan = 0;
  let redDoraHan = 0;
  let uraDoraHan = 0;

  for (const tile of tiles) {
    doraHan += doraKinds.filter(kind => kind === tile.kind).length;
    uraDoraHan += uraKinds.filter(kind => kind === tile.kind).length;
    if (tile.red) redDoraHan += 1;
  }

  return {
    doraHan,
    redDoraHan,
    uraDoraHan,
    totalDoraHan: doraHan + redDoraHan + uraDoraHan,
  };
}

export function getUraDoraIndicators(deadWall: Tile[], count: number): Tile[] {
  return deadWall.slice(9, 9 + count);
}
