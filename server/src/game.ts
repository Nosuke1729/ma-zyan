import { createWall, Mode } from './rules/wall.js';
import { Tile, TileKind } from './rules/tiles.js';
import { findAgariShapes } from './rules/agari.js';
import { detectYaku, YakuResult } from './rules/yaku.js';

export type PlayerState = {
  id: string;
  hand: Tile[];
  discards: Tile[];
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
  message: string;
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
  lastDiscard?: LastDiscard;
  ended: boolean;
  result?: RoundResult;
};

export function createInitialGame(mode: Mode, playerIds: string[]): GameState {
  const wall = createWall(mode);
  const deadWall = wall.splice(-14);
  const players: PlayerState[] = playerIds.map(id => ({
    id,
    hand: [],
    discards: [],
    points: mode === 'yonma' ? 25000 : 35000,
    riichi: false,
  }));

  for (let i = 0; i < 13; i++) {
    for (const player of players) player.hand.push(wall.shift()!);
  }

  players[0].hand.push(wall.shift()!);

  return {
    mode,
    players,
    wall,
    deadWall,
    doraIndicators: [deadWall[4]],
    turn: 0,
    dealer: 0,
    round: 0,
    ended: false,
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
    game.ended = true;
    game.result = { type: 'draw', message: '流局しました。' };
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
  if (player.points < 1000) throw new Error('リーチ棒を出す点数が足りません。');
  if (player.hand.length % 3 !== 2) throw new Error('リーチはツモ後に宣言してください。');

  player.riichi = true;
  player.points -= 1000;
}

export function claimTsumo(game: GameState, playerId: string): RoundResult {
  assertPlaying(game);
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.turn) throw new Error('あなたの番ではありません。');

  const player = game.players[playerIndex];
  const result = judgeWin(game, playerIndex, player.hand.map(t => t.kind), true);
  game.ended = true;
  game.result = {
    type: 'tsumo',
    winnerIndex: playerIndex,
    ...result,
    message: `Player ${playerIndex + 1} のツモ和了: ${result.yaku.map(y => y.name).join('、')}`,
  };
  return game.result;
}

export function claimRon(game: GameState, playerId: string): RoundResult {
  assertPlaying(game);
  if (!game.lastDiscard) throw new Error('ロンできる捨て牌がありません。');

  const winnerIndex = game.players.findIndex(p => p.id === playerId);
  if (winnerIndex === game.lastDiscard.fromPlayerIndex) throw new Error('自分の捨て牌ではロンできません。');

  const player = game.players[winnerIndex];
  const kinds = [...player.hand.map(t => t.kind), game.lastDiscard.tile.kind];
  const result = judgeWin(game, winnerIndex, kinds, false);
  game.ended = true;
  game.result = {
    type: 'ron',
    winnerIndex,
    loserIndex: game.lastDiscard.fromPlayerIndex,
    ...result,
    message: `Player ${winnerIndex + 1} のロン和了: ${result.yaku.map(y => y.name).join('、')}`,
  };
  return game.result;
}

function judgeWin(game: GameState, playerIndex: number, kinds: TileKind[], tsumo: boolean) {
  const shapes = findAgariShapes(kinds);
  if (shapes.length === 0) throw new Error(tsumo ? 'この手牌ではツモ和了できません。' : 'この捨て牌ではロンできません。');

  const player = game.players[playerIndex];
  const yaku = detectYaku(kinds, shapes[0], {
    closed: true,
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
    roundWind: 'east',
  });

  if (yaku.length === 0) throw new Error('和了形ですが、役がありません。');

  const yakuman = yaku.reduce((sum, item) => sum + (item.yakuman ?? 0), 0);
  const han = yakuman > 0 ? 0 : yaku.reduce((sum, item) => sum + (item.han ?? 0), 0);
  return { yaku, han, yakuman };
}

function indexToWind(index: number) {
  return (['east', 'south', 'west', 'north'] as const)[index] ?? 'east';
}

function assertPlaying(game: GameState) {
  if (game.ended) throw new Error('この局は終了しています。');
}

export function getPlayerView(game: GameState, viewerId: string) {
  return {
    mode: game.mode,
    turn: game.turn,
    wallCount: game.wall.length,
    doraIndicators: game.doraIndicators,
    lastDiscard: game.lastDiscard,
    ended: game.ended,
    result: game.result,
    players: game.players.map((player, index) => ({
      id: player.id,
      index,
      points: player.points,
      hand: player.id === viewerId ? player.hand : undefined,
      handCount: player.hand.length,
      discards: player.discards,
      riichi: player.riichi,
    })),
  };
}
