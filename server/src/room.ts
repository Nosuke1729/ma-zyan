import { WebSocket } from 'ws';
import { createInitialGame, GameState, getPlayerView } from './game.js';
import { Mode } from './rules/wall.js';

export type Player = {
  id: string;
  name: string;
  ws: WebSocket;
};

export type Room = {
  id: string;
  mode: Mode;
  players: Player[];
  game?: GameState;
};

export class RoomManager {
  rooms = new Map<string, Room>();

  createRoom(mode: Mode, player: Player): Room {
    const room: Room = {
      id: Math.random().toString(36).slice(2, 8).toUpperCase(),
      mode,
      players: [player],
    };
    this.rooms.set(room.id, room);
    return room;
  }

  joinRoom(roomId: string, player: Player): Room {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) throw new Error('部屋が見つかりません。');

    const max = room.mode === 'yonma' ? 4 : 3;
    if (room.players.length >= max) throw new Error('部屋が満員です。');
    if (room.game) throw new Error('すでに対局が始まっています。');

    room.players.push(player);
    return room;
  }

  startGame(room: Room) {
    const required = room.mode === 'yonma' ? 4 : 3;
    if (room.players.length !== required) throw new Error(`${required}人そろうまで開始できません。`);
    room.game = createInitialGame(room.mode, room.players.map(p => p.id));
    this.broadcastGame(room);
  }

  nextRound(room: Room) {
    if (!room.game) throw new Error('対局が始まっていません。');
    if (!room.game.ended) throw new Error('現在の局がまだ終了していません。');

    const oldGame = room.game;
    const points = oldGame.players.map(player => player.points);
    const winner = oldGame.result?.winnerIndex;
    const dealerWon = winner === oldGame.dealer;
    const draw = oldGame.result?.type === 'draw';
    const nextDealer = dealerWon || draw ? oldGame.dealer : (oldGame.dealer + 1) % oldGame.players.length;
    const nextRound = nextDealer === oldGame.dealer ? oldGame.round : oldGame.round + 1;
    const nextHonba = dealerWon || draw ? oldGame.honba + 1 : 0;

    room.game = createInitialGame(room.mode, room.players.map(p => p.id), {
      initialPoints: points,
      dealer: nextDealer,
      round: nextRound,
      honba: nextHonba,
      riichiSticks: oldGame.riichiSticks,
    });
    this.broadcastGame(room);
  }

  broadcastRoom(room: Room) {
    for (const player of room.players) {
      player.ws.send(JSON.stringify({
        type: 'room_update',
        room: {
          id: room.id,
          mode: room.mode,
          players: room.players.map(p => ({ id: p.id, name: p.name })),
          started: Boolean(room.game),
        },
      }));
    }
  }

  broadcastGame(room: Room) {
    if (!room.game) return;
    for (const player of room.players) {
      player.ws.send(JSON.stringify({
        type: 'game_update',
        state: getPlayerView(room.game, player.id),
      }));
    }
  }
}
