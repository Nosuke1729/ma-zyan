import { AgariShape } from './agari.js';
import { TileKind, isHonor, isTerminal, isYaochu, tileSuit } from './tiles.js';

export type Wind = 'east' | 'south' | 'west' | 'north';

export type WinContext = {
  closed: boolean;
  tsumo: boolean;
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  rinshan: boolean;
  chankan: boolean;
  haitei: boolean;
  houtei: boolean;
  tenhou: boolean;
  chiihou: boolean;
  seatWind: Wind;
  roundWind: Wind;
};

export type YakuResult = { name: string; han?: number; yakuman?: number };

const WIND_TO_TILE: Record<Wind, TileKind> = {
  east: '1z', south: '2z', west: '3z', north: '4z'
};

export function detectYaku(kinds: TileKind[], shape: AgariShape, ctx: WinContext): YakuResult[] {
  const yaku: YakuResult[] = [];

  if (ctx.tenhou) yaku.push({ name: '天和', yakuman: 1 });
  if (ctx.chiihou) yaku.push({ name: '地和', yakuman: 1 });
  if (shape.type === 'kokushi') yaku.push({ name: '国士無双', yakuman: 1 });
  if (isDaisangen(shape)) yaku.push({ name: '大三元', yakuman: 1 });
  if (isTsuuiisou(kinds)) yaku.push({ name: '字一色', yakuman: 1 });
  if (isChinroutou(kinds)) yaku.push({ name: '清老頭', yakuman: 1 });
  if (yaku.some(x => x.yakuman)) return yaku;

  if (ctx.closed && ctx.tsumo) yaku.push({ name: '門前清自摸和', han: 1 });
  if (ctx.doubleRiichi) yaku.push({ name: 'ダブル立直', han: 2 });
  else if (ctx.riichi) yaku.push({ name: '立直', han: 1 });
  if (ctx.ippatsu) yaku.push({ name: '一発', han: 1 });
  if (ctx.rinshan) yaku.push({ name: '嶺上開花', han: 1 });
  if (ctx.chankan) yaku.push({ name: '槍槓', han: 1 });
  if (ctx.haitei) yaku.push({ name: '海底摸月', han: 1 });
  if (ctx.houtei) yaku.push({ name: '河底撈魚', han: 1 });
  if (isTanyao(kinds)) yaku.push({ name: '断么九', han: 1 });
  if (shape.type === 'chiitoi') yaku.push({ name: '七対子', han: 2 });

  if (shape.type === 'standard') {
    for (const meld of shape.melds) {
      if (meld.type !== 'triplet') continue;
      const k = meld.tiles[0];
      if (k === '5z') yaku.push({ name: '役牌 白', han: 1 });
      if (k === '6z') yaku.push({ name: '役牌 發', han: 1 });
      if (k === '7z') yaku.push({ name: '役牌 中', han: 1 });
      if (k === WIND_TO_TILE[ctx.seatWind]) yaku.push({ name: '役牌 自風', han: 1 });
      if (k === WIND_TO_TILE[ctx.roundWind]) yaku.push({ name: '役牌 場風', han: 1 });
    }
    if (shape.melds.every(m => m.type === 'triplet')) yaku.push({ name: '対々和', han: 2 });
    if (ctx.closed && isIipeikou(shape)) yaku.push({ name: '一盃口', han: 1 });
  }

  const flush = detectFlush(kinds, ctx.closed);
  if (flush) yaku.push(flush);
  return yaku;
}

function isTanyao(kinds: TileKind[]): boolean {
  return kinds.every(k => !isYaochu(k));
}

function isIipeikou(shape: AgariShape): boolean {
  if (shape.type !== 'standard') return false;
  const seqs = shape.melds.filter(m => m.type === 'sequence').map(m => m.tiles.join(','));
  return new Set(seqs).size < seqs.length;
}

function detectFlush(kinds: TileKind[], closed: boolean): YakuResult | null {
  const suits = new Set(kinds.filter(k => !isHonor(k)).map(k => tileSuit(k)));
  const hasHonor = kinds.some(isHonor);
  if (suits.size !== 1) return null;
  return hasHonor ? { name: '混一色', han: closed ? 3 : 2 } : { name: '清一色', han: closed ? 6 : 5 };
}

function isDaisangen(shape: AgariShape): boolean {
  if (shape.type !== 'standard') return false;
  const triplets = new Set(shape.melds.filter(m => m.type === 'triplet').map(m => m.tiles[0]));
  return triplets.has('5z') && triplets.has('6z') && triplets.has('7z');
}

function isTsuuiisou(kinds: TileKind[]): boolean {
  return kinds.every(isHonor);
}

function isChinroutou(kinds: TileKind[]): boolean {
  return kinds.every(k => !isHonor(k) && isTerminal(k));
}
