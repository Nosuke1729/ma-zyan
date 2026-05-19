import './style.css';

type Tile = { id: string; kind: string; red?: boolean };

type PlayerView = {
  id: string;
  index: number;
  points: number;
  hand?: Tile[];
  handCount: number;
  discards: Tile[];
  riichi: boolean;
};

type GameView = {
  mode: 'yonma' | 'sanma';
  turn: number;
  wallCount: number;
  doraIndicators: Tile[];
  players: PlayerView[];
};

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8787';
const ws = new WebSocket(WS_URL);

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="page">
    <section class="hero">
      <p class="eyebrow">Online Japanese Mahjong</p>
      <h1>ma-zyan</h1>
      <p>四麻・三麻の部屋を作って、ブラウザでリアルタイム対戦できます。</p>
    </section>

    <section class="panel">
      <input id="name" placeholder="名前" />
      <div class="row">
        <button id="createYonma">四麻の部屋を作る</button>
        <button id="createSanma">三麻の部屋を作る</button>
      </div>
      <div class="row">
        <input id="roomId" placeholder="部屋ID" />
        <button id="join">参加</button>
        <button id="start">開始</button>
      </div>
      <div id="log" class="log"></div>
    </section>

    <section id="table" class="table hidden"></section>
  </main>
`;

function send(message: unknown) {
  if (ws.readyState !== WebSocket.OPEN) {
    writeLog('サーバーに接続中です。少し待ってからもう一度押してください。', true);
    return;
  }
  ws.send(JSON.stringify(message));
}

function getName() {
  return document.querySelector<HTMLInputElement>('#name')!.value || 'Guest';
}

function writeLog(text: string, error = false) {
  const log = document.querySelector('#log')!;
  log.innerHTML += `<p class="${error ? 'error' : ''}">${escapeHtml(text)}</p>`;
}

document.querySelector('#createYonma')!.addEventListener('click', () => {
  send({ type: 'create_room', mode: 'yonma', name: getName() });
});

document.querySelector('#createSanma')!.addEventListener('click', () => {
  send({ type: 'create_room', mode: 'sanma', name: getName() });
});

document.querySelector('#join')!.addEventListener('click', () => {
  const roomId = document.querySelector<HTMLInputElement>('#roomId')!.value;
  send({ type: 'join_room', roomId, name: getName() });
});

document.querySelector('#start')!.addEventListener('click', () => {
  send({ type: 'start_game' });
});

ws.addEventListener('open', () => writeLog('サーバーに接続しました。'));
ws.addEventListener('close', () => writeLog('サーバー接続が切れました。', true));

ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'room_created') {
    writeLog(`部屋ID: ${msg.roomId}`);
  }

  if (msg.type === 'room_update') {
    const names = msg.room.players.map((p: { name: string }) => p.name).join(' / ');
    document.querySelector('#log')!.innerHTML = `
      <p>部屋: <b>${msg.room.id}</b> / ${msg.room.mode === 'yonma' ? '四麻' : '三麻'}</p>
      <p>参加者: ${escapeHtml(names)}</p>
    `;
  }

  if (msg.type === 'game_update') renderTable(msg.state);
  if (msg.type === 'error') writeLog(msg.message, true);
});

function renderTable(state: GameView) {
  const table = document.querySelector<HTMLElement>('#table')!;
  table.classList.remove('hidden');
  const me = state.players.find(p => p.hand);
  const myHand = me?.hand ?? [];

  table.innerHTML = `
    <div class="tableTop">
      <div><span>モード</span><b>${state.mode === 'yonma' ? '四麻' : '三麻'}</b></div>
      <div><span>山</span><b>${state.wallCount}</b></div>
      <div><span>ドラ表示</span>${state.doraIndicators.map(renderSmallTile).join('')}</div>
    </div>

    <div class="players">
      ${state.players.map(player => `
        <article class="player ${state.turn === player.index ? 'active' : ''}">
          <h2>Player ${player.index + 1} ${state.turn === player.index ? '▶' : ''}</h2>
          <p>${player.points}点 / 手牌 ${player.handCount}枚</p>
          <div class="discards">${player.discards.map(renderSmallTile).join('')}</div>
        </article>
      `).join('')}
    </div>

    <div class="myHand">
      ${myHand.map(tile => `
        <button class="tile" data-id="${tile.id}">${tileLabel(tile)}</button>
      `).join('')}
    </div>
  `;

  table.querySelectorAll<HTMLButtonElement>('.tile').forEach(button => {
    button.addEventListener('click', () => {
      send({ type: 'discard', tileId: button.dataset.id });
    });
  });
}

function renderSmallTile(tile: Tile) {
  return `<span class="smallTile">${tileLabel(tile)}</span>`;
}

function tileLabel(tile: Tile) {
  const kind = tile.kind;
  const suit = kind[1];
  const n = kind[0];
  const honors: Record<string, string> = {
    '1z': '東', '2z': '南', '3z': '西', '4z': '北', '5z': '白', '6z': '發', '7z': '中'
  };
  const suits: Record<string, string> = { m: '萬', p: '筒', s: '索' };
  if (suit === 'z') return honors[kind] ?? kind;
  return `${tile.red ? '赤' : ''}${n}${suits[suit]}`;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[ch]!));
}
