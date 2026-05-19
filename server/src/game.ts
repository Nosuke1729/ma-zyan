import { createWall, Mode } from './rules/wall.js';
import { Tile } from './rules/tiles.js';

export type PlayerState = {
  id: string;
  hand: Tile[];
  discards: Tile[];
  points: number;
  riichi: boolean;
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
  };
}

export function discardTile(game: GameState, playerId: string, tileId: string) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== game.turn) throw new Error('あなたの番ではありません。');

  const player = game.players[playerIndex];
  const tileIndex = player.hand.findIndex(t => t.id === tileId);
  if (tileIndex === -1) throw new Error('その牌は手牌にありません。');

  const [tile] = player.hand.splice(tileIndex, 1);
  player.discards.push(tile);

  game.turn = (game.turn + 1) % game.players.length;
  const drawn = game.wall.shift();
  if (drawn) game.players[game.turn].hand.push(drawn);
}

export function getPlayerView(game: GameState, viewerId: string) {
  return {
    mode: game.mode,
    turn: game.turn,
    wallCount: game.wall.length,
    doraIndicators: game.doraIndicators,
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
