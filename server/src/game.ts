import { createWall, Mode } from './rules/wall.js';
import { Tile, TileKind } from './rules/tiles.js';
import { findAgariShapes } from './rules/agari.js';
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
    melds: [],
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
  if (player.melds.length > 0) throw new Error('鳴いているためリーチできません。');
  if (player.points < 1000) throw new Error('リーチ棒を出す点数が足りません。');
  if (player.hand.length % 3 !== 2) throw new Error('リーチはツモ後に宣言してください。');

  player.riichi = true;
  player.points -= 1000;
}

export function claimPon(game: GameState, playerId: string) {
  assertPlaying(game);
  const { player, playerIndex, discard } = getClaimContext(game, playerId);
  const sameTiles = player.hand.filter(tile => tile.kind === discard.tile.kind).slice(0, 2);
  if (sameTiles.length < 2) throw new Error('ポンできる牌が足りません。');

  removeTilesFromHand(player, sameTiles.map(t => t.id));
  removeLastDiscard(game);
  player.melds.push({ type: 'pon', tiles: [...sameTiles, discard.tile], fromPlayerIndex: discard.fromPlayerIndex, open: true });
  game.turn = playerIndex;
  game.lastDiscard = undefined;
}

export function claimKan(game: GameState, playerId: string) {
  assertPlaying(game);
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  const player = game.players[playerIndex];
  if (!player) throw new Error('プレイヤーが見つかりません。');

  if (game.lastDiscard && game.lastDiscard.fromPlayerIndex !== playerIndex) {
    const sameTiles = player.hand.filter(tile => tile.kind === game.lastDiscard!.tile.kind).slice(0, 3);
    if (sameTiles.length < 3) throw new Error('大明槓できる牌が足りません。');
    removeTilesFromHand(player, sameTiles.map(t => t.id));
    removeLastDiscard(game);
    player.melds.push({ type: 'kan', tiles: [...sameTiles, game.lastDiscard.tile], fromPlayerIndex: game.lastDiscard.fromPlayerIndex, open: true });
    game.turn = playerIndex;
    game.lastDiscard = undefined;
    drawRinshan(game, player);
    flipKanDora(game);
    return;
  }

  const counts = new Map<TileKind, Tile[]>();
  for (const tile of player.hand) counts.set(tile.kind, [...(counts.get(tile.kind) ?? []), tile]);
  const closedKan = [...counts.values()].find(tiles => tiles.length === 4);
  if (!closedKan) throw new Error('カンできる4枚組がありません。');
  removeTilesFromHand(player, closedKan.map(t => t.id));
  player.melds.push({ type: 'kan', tiles: closedKan, fromPlayerIndex: playerIndex, open: false });
  drawRinshan(game, player);
  flipKanDora(game);
}

export function claimChi(game: GameState, playerId: string) {
  assertPlaying(game);
  const { player, playerIndex, discard } = getClaimContext(game, playerId);
  const nextPlayer = (discard.fromPlayerIndex + 1) % game.players.length;
  if (playerIndex !== nextPlayer) throw new Error('チーは上家の捨て牌に対してのみできます。');
  if (discard.tile.kind.endsWith('z')) throw new Error('字牌はチーできません。');

  const suit = discard.tile.kind[1];
  const n = Number(discard.tile.kind[0]);
  const candidates = [
    [n - 2, n - 1],
    [n - 1, n + 1],
    [n + 1, n + 2],
  ].filter(pair => pair.every(x => x >= 1 && x <= 9));

  for (const pair of candidates) {
    const needed = pair.map(x => `${x}${suit}` as TileKind);
    const tiles = needed.map(kind => player.hand.find(t => t.kind === kind));
    if (tiles.every(Boolean)) {
      const chosen = tiles as Tile[];
      removeTilesFromHand(player, chosen.map(t => t.id));
      removeLastDiscard(game);
      player.melds.push({ type: 'chi', tiles: [...chosen, discard.tile], fromPlayerIndex: discard.fromPlayerIndex, open: true });
      game.turn = playerIndex;
      game.lastDiscard = undefined;
      return;
    }
  }

  throw new Error('チーできる並びがありません。');
}

export function claimTsumo(game: GameState, playerId: string): RoundResult {
  assertPlaying(game);
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.turn) throw new Error('あなたの番ではありません。');

  const player = game.players[playerIndex];
  const result = judgeWin(game, playerIndex, player.hand.map(t => t.kind), true);
  applySimpleScore(game, playerIndex, undefined, result.han, result.yakuman);
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
  applySimpleScore(game, winnerIndex, game.lastDiscard.fromPlayerIndex, result.han, result.yakuman);
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
    roundWind: 'east',
  });

  if (yaku.length === 0) throw new Error('和了形ですが、役がありません。');

  const yakuman = yaku.reduce((sum, item) => sum + (item.yakuman ?? 0), 0);
  const han = yakuman > 0 ? 0 : yaku.reduce((sum, item) => sum + (item.han ?? 0), 0);
  return { yaku, han, yakuman };
}

function getClaimContext(game: GameState, playerId: string) {
  if (!game.lastDiscard) throw new Error('鳴ける捨て牌がありません。');
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('プレイヤーが見つかりません。');
  if (playerIndex === game.lastDiscard.fromPlayerIndex) throw new Error('自分の捨て牌は鳴けません。');
  const player = game.players[playerIndex];
  return { player, playerIndex, discard: game.lastDiscard };
}

function removeTilesFromHand(player: PlayerState, tileIds: string[]) {
  for (const tileId of tileIds) {
    const index = player.hand.findIndex(tile => tile.id === tileId);
    if (index === -1) throw new Error('手牌の処理に失敗しました。');
    player.hand.splice(index, 1);
  }
}

function removeLastDiscard(game: GameState) {
  if (!game.lastDiscard) return;
  const from = game.players[game.lastDiscard.fromPlayerIndex];
  const index = from.discards.findIndex(tile => tile.id === game.lastDiscard!.tile.id);
  if (index >= 0) from.discards.splice(index, 1);
}

function drawRinshan(game: GameState, player: PlayerState) {
  const tile = game.deadWall.shift();
  if (!tile) throw new Error('嶺上牌がありません。');
  player.hand.push(tile);
}

function flipKanDora(game: GameState) {
  const next = game.deadWall[4 + game.doraIndicators.length];
  if (next) game.doraIndicators.push(next);
}

function applySimpleScore(game: GameState, winnerIndex: number, loserIndex: number | undefined, han: number, yakuman: number) {
  const base = yakuman > 0 ? yakuman * 32000 : Math.max(1000, Math.min(12000, han * 2000));
  const winner = game.players[winnerIndex];

  if (loserIndex !== undefined) {
    game.players[loserIndex].points -= base;
    winner.points += base;
    return;
  }

  const each = Math.ceil(base / (game.players.length - 1));
  for (let i = 0; i < game.players.length; i++) {
    if (i === winnerIndex) continue;
    game.players[i].points -= each;
    winner.points += each;
  }
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
      melds: player.melds,
      riichi: player.riichi,
    })),
  };
}
