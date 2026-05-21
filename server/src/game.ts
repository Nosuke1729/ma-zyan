import { createWall, Mode } from './rules/wall.js';
import { Tile, TileKind } from './rules/tiles.js';
import { findAgariShapes, getWinningKinds, isTenpai } from './rules/agari.js';
import { countDora, getUraDoraIndicators } from './rules/dora.js';
import { detectYaku, YakuResult } from './rules/yaku.js';

export type Meld = {
  type: 'chi' | 'pon' | 'kan';
  tiles: Tile[];
  fromPlayerIndex: number;
  open: boolean;
};

export type PlayerState = {
  id: string;
  hand: Tile[];
  discards: Tile[];
  melds: Meld[];
  points: number;
  riichi: boolean;
};

export type LastDiscard = {
  tile: Tile;
  fromPlayerIndex: number;
};

export type RoundResult = {
  type: 'tsumo' | 'ron' | 'draw';
  winnerIndex?: number;
  loserIndex?: number;
  yaku?: YakuResult[];
  han?: number;
  yakuman?: number;
  doraHan?: number;
  redDoraHan?: number;
  uraDoraHan?: number;
  totalHan?: number;
  tenpaiIndexes?: number[];
  notenIndexes?: number[];
  message: string;
};

export type NewGameOptions = {
  initialPoints?: number[];
  dealer?: number;
  round?: number;
  honba?: number;
  riichiSticks?: number;
};

export type GameState = {
  mode: Mode;
  players: PlayerState[];
  wall: Tile[];
  deadWall: Tile[];
  doraIndicators: Tile[];
  turn: number;
  dealer: number;
  round: number;
  honba: number;
  riichiSticks: number;
  lastDiscard?: LastDiscard;
  ended: boolean;
  exhaustiveDraw: boolean;
  result?: RoundResult;
};

export function createInitialGame(mode: Mode, playerIds: string[], options: NewGameOptions = {}): GameState {
  const wall = createWall(mode);
  const deadWall = wall.splice(-14);
  const dealer = options.dealer ?? 0;
  const players: PlayerState[] = playerIds.map((id, index) => ({
    id,
    hand: [],
    discards: [],
    melds: [],
    points: options.initialPoints?.[index] ?? (mode === 'yonma' ? 25000 : 35000),
    riichi: false,
  }));

  for (let i = 0; i < 13; i++) {
    for (const player of players) player.hand.push(wall.shift()!);
  }

  players[dealer].hand.push(wall.shift()!);

  return {
    mode,
    players,
    wall,
    deadWall,
    doraIndicators: [deadWall[4]],
    turn: dealer,
    dealer,
    round: options.round ?? 0,
    honba: options.honba ?? 0,
    riichiSticks: options.riichiSticks ?? 0,
    ended: false,
    exhaustiveDraw: false,
  };
}

export function discardTile(game: GameState, playerId: string, tileId: string) {
  assertPlaying(game);
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.turn) throw new Error('あなたの番ではありません。');

  const player = game.players[playerIndex];
  const tileIndex = player.hand.findIndex(t => t.id === tileId);
  if (tileIndex === -1) throw new Error('その牌は手牌にありません。');

  const [tile] = player.hand.splice(tileIndex, 1);
  player.discards.push(tile);
  game.lastDiscard = { tile, fromPlayerIndex: playerIndex };

  if (game.wall.length === 0) {
    applyExhaustiveDraw(game);
    return;
  }

  game.turn = (game.turn + 1) % game.players.length;
  const drawn = game.wall.shift();
  if (drawn) game.players[game.turn].hand.push(drawn);
}

export function declareRiichi(game: GameState, playerId: string) {
  assertPlaying(game);
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.turn) throw new Error('あなたの番ではありません。');
  const player = game.players[playerIndex];
  if (player.riichi) throw new Error('すでにリーチしています。');
  if (player.melds.length > 0) throw new Error('鳴いているためリーチできません。');
  if (player.points < 1000) throw new Error('リーチ棒を出す点数が足りません。');
  if (player.hand.length % 3 !== 2) throw new Error('リーチはツモ後に宣言してください。');
  if (!isTenpaiAfterDiscard(player)) throw new Error('テンパイしていないためリーチできません。');

  player.riichi = true;
  player.points -= 1000;
  game.riichiSticks += 1;
}

function judgeWin(game: GameState, playerIndex: number, tiles: Tile[], tsumo: boolean) {
  const kinds = tiles.map(tile => tile.kind);
  const shapes = findAgariShapes(kinds);
  if (shapes.length === 0) throw new Error(tsumo ? 'この手牌ではツモ和了できません。' : 'この捨て牌ではロンできません。');

  const player = game.players[playerIndex];
  const yaku = detectYaku(kinds, shapes[0], {
    closed: player.melds.length === 0,
    tsumo,
    riichi: player.riichi,
    doubleRiichi: false,
    ippatsu: false,
    rinshan: false,
    chankan: false,
    haitei: tsumo && game.wall.length === 0,
    houtei: !tsumo && game.wall.length === 0,
    tenhou: false,
    chiihou: false,
    seatWind: indexToWind(playerIndex),
    roundWind: roundWind(game.round),
  });

  if (yaku.length === 0) throw new Error('和了形ですが、役がありません。');

  const dora = countDora(
    tiles,
    game.doraIndicators,
    getUraDoraIndicators(game.deadWall, game.doraIndicators.length),
    player.riichi,
  );

  const yakuman = yaku.reduce((sum, item) => sum + (item.yakuman ?? 0), 0);
  const baseHan = yakuman > 0 ? 0 : yaku.reduce((sum, item) => sum + (item.han ?? 0), 0);
  const totalHan = yakuman > 0 ? 0 : baseHan + dora.totalDoraHan;

  return {
    yaku,
    han: totalHan,
    yakuman,
    doraHan: dora.doraHan,
    redDoraHan: dora.redDoraHan,
    uraDoraHan: dora.uraDoraHan,
    totalHan,
  };
}
