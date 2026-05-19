import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { RoomManager, Player } from './room.js';
import { claimRon, claimTsumo, declareRiichi, discardTile } from './game.js';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('ma-zyan websocket server');
});

const wss = new WebSocketServer({ server });
const rooms = new RoomManager();
const playerToRoom = new Map<string, string>();

wss.on('connection', ws => {
  const playerId = crypto.randomUUID();

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'create_room') {
        const player: Player = { id: playerId, name: msg.name || 'Guest', ws };
        const room = rooms.createRoom(msg.mode, player);
        playerToRoom.set(playerId, room.id);
        ws.send(JSON.stringify({ type: 'room_created', roomId: room.id }));
        rooms.broadcastRoom(room);
        return;
      }

      if (msg.type === 'join_room') {
        const player: Player = { id: playerId, name: msg.name || 'Guest', ws };
        const room = rooms.joinRoom(msg.roomId, player);
        playerToRoom.set(playerId, room.id);
        rooms.broadcastRoom(room);
        return;
      }

      if (msg.type === 'start_game') {
        const room = getOwnRoom(playerId);
        rooms.startGame(room);
        rooms.broadcastRoom(room);
        return;
      }

      if (msg.type === 'discard') {
        const room = getOwnRoom(playerId);
        if (!room.game) throw new Error('対局が始まっていません。');
        discardTile(room.game, playerId, msg.tileId);
        rooms.broadcastGame(room);
        return;
      }

      if (msg.type === 'riichi') {
        const room = getOwnRoom(playerId);
        if (!room.game) throw new Error('対局が始まっていません。');
        declareRiichi(room.game, playerId);
        rooms.broadcastGame(room);
        return;
      }

      if (msg.type === 'tsumo') {
        const room = getOwnRoom(playerId);
        if (!room.game) throw new Error('対局が始まっていません。');
        claimTsumo(room.game, playerId);
        rooms.broadcastGame(room);
        return;
      }

      if (msg.type === 'ron') {
        const room = getOwnRoom(playerId);
        if (!room.game) throw new Error('対局が始まっていません。');
        claimRon(room.game, playerId);
        rooms.broadcastGame(room);
        return;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : '不明なエラーです。',
      }));
    }
  });
});

function getOwnRoom(playerId: string) {
  const roomId = playerToRoom.get(playerId);
  if (!roomId) throw new Error('部屋に入っていません。');
  const room = rooms.rooms.get(roomId);
  if (!room) throw new Error('部屋が見つかりません。');
  return room;
}

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`Mahjong server running on ${port}`);
});
