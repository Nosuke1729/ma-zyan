import './style.css';

type Tile = { id: string; kind: string; red?: boolean };
type Meld = { type: 'chi' | 'pon' | 'kan'; tiles: Tile[]; open: boolean; fromPlayerIndex: number };

type PlayerView = {
  id: string;
  index: number;
  points: number;
  hand?: Tile[];
  handCount: number;
  discards: Tile[];
  melds?: Meld[];
  riichi: boolean;
};

type YakuResult = { name: string; han?: number; yakuman?: number };

type RoundResult = {
  type: 'tsumo' | 'ron' | 'draw';
  winnerIndex?: number;
  loserIndex?: number;
  yaku?: YakuResult[];
  han?: number;
  yakuman?: number;
  message: string;
};

type GameView = {
  mode: 'yonma' | 'sanma';
  turn: number;
  dealer: number;
  round: number;
  honba: number;
  riichiSticks: number;
  wallCount: number;
  doraIndicators: Tile[];
  ended: boolean;
  result?: RoundResult;
  lastDiscard?: { tile: Tile; fromPlayerIndex: number };
  players: PlayerView[];
};

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || localStorage.getItem('mazyan_ws_url') || '';
let ws: WebSocket | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="page">
    <section class="hero">
      <p class="eyebrow">Online Japanese Mahjong</p>
      <h1>ma-zyan</h1>
      <p>四麻・三麻の部屋を作って、ブラウザでリアルタイム対戦できます。</p>
    </section>

    <section class="panel connectionPanel">
      <label class="fieldLabel" for="serverUrl">Render WebSocket URL</label>
      <div class="row">
        <input id="serverUrl" class="serverInput" placeholder="wss://your-server.onrender.com" value="${escapeHtml(DEFAULT_WS_URL)}" />
        <button id="connect">接続</button>
      </div>
      <p class="hint">Renderを作った後、ここに <b>wss://...</b> を入れると、このGitHub Pages上でオンライン対戦できます。</p>
      <p id="status" class="status ${DEFAULT_WS_URL ? '' : 'warn'}">${DEFAULT_WS_URL ? '未接続' : 'Render URL 未設定'}</p>
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

if (DEFAULT_WS_URL) connect(DEFAULT_WS_URL);

document.querySelector('#connect')!.addEventListener('click', () => {
  const value = document.querySelector<HTMLInputElement>('#serverUrl')!.value.trim();
  connect(value);
});

function connect(url: string) {
  if (!url) {
    setStatus('Render URL 未設定', true);
    writeLog('Renderでサーバーを作った後、wss://... のURLを入力してください。', true);
    return;
  }

  if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
    setStatus('URLは ws:// または wss:// で始めてください。', true);
    return;
  }

  ws?.close();
  localStorage.setItem('mazyan_ws_url', url);
  setStatus('接続中...');
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    setStatus('接続済み');
    writeLog('サーバーに接続しました。');
  });

  ws.addEventListener('close', () => {
    setStatus('未接続', true);
    writeLog('サーバー接続が切れました。Renderが未起動、URL違い、またはスリープ中の可能性があります。', true);
  });

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
}

function setStatus(text: string, warn = false) {
  const status = document.querySelector('#status')!;
  status.textContent = text;
  status.className = `status ${warn ? 'warn' : ''}`;
}

function send(message: unknown) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    writeLog('まだサーバーに接続できていません。Render URLを入力して「接続」を押してください。', true);
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

function renderTable(state: GameView) {
  const table = document.querySelector<HTMLElement>('#table')!;
  table.classList.remove('hidden');
  const me = state.players.find(p => p.hand);
  const myHand = me?.hand ?? [];
  const myTurn = Boolean(me && state.turn === me.index && !state.ended);

  table.innerHTML = `
    <div class="tableTop tableTopWide">
      <div><span>局</span><b>${roundLabel(state.round)}</b></div>
      <div><span>本場</span><b>${state.honba}</b></div>
      <div><span>供託</span><b>${state.riichiSticks}</b></div>
      <div><span>親</span><b>Player ${state.dealer + 1}</b></div>
      <div><span>山</span><b>${state.wallCount}</b></div>
      <div><span>ドラ表示</span>${state.doraIndicators.map(renderSmallTile).join('')}</div>
    </div>

    ${state.result ? renderResult(state.result) : ''}

    <div class="actionBar">
      <button id="riichi" ${myTurn ? '' : 'disabled'}>リーチ</button>
      <button id="tsumo" ${myTurn ? '' : 'disabled'}>ツモ</button>
      <button id="ron" ${state.ended ? 'disabled' : ''}>ロン</button>
      <button id="pon" ${state.ended ? 'disabled' : ''}>ポン</button>
      <button id="chi" ${state.ended ? 'disabled' : ''}>チー</button>
      <button id="kan" ${state.ended ? 'disabled' : ''}>カン</button>
      <button id="nextRound" class="nextButton" ${state.ended ? '' : 'disabled'}>次局へ</button>
    </div>

    <div class="players">
      ${state.players.map(player => `
        <article class="player ${state.turn === player.index ? 'active' : ''} ${state.dealer === player.index ? 'dealer' : ''}">
          <h2>Player ${player.index + 1} ${state.dealer === player.index ? '親' : ''} ${state.turn === player.index && !state.ended ? '▶' : ''}</h2>
          <p>${player.points}点 / 手牌 ${player.handCount}枚 ${player.riichi ? '/ リーチ' : ''}</p>
          <div class="melds">${(player.melds ?? []).map(renderMeld).join('')}</div>
          <div class="discards">${player.discards.map(renderSmallTile).join('')}</div>
        </article>
      `).join('')}
    </div>

    <div class="myHand">
      ${myHand.map(tile => `
        <button class="tile" data-id="${tile.id}" ${myTurn ? '' : 'disabled'}>${tileLabel(tile)}</button>
      `).join('')}
    </div>
  `;

  table.querySelectorAll<HTMLButtonElement>('.tile').forEach(button => {
    button.addEventListener('click', () => {
      send({ type: 'discard', tileId: button.dataset.id });
    });
  });

  table.querySelector<HTMLButtonElement>('#riichi')?.addEventListener('click', () => send({ type: 'riichi' }));
  table.querySelector<HTMLButtonElement>('#tsumo')?.addEventListener('click', () => send({ type: 'tsumo' }));
  table.querySelector<HTMLButtonElement>('#ron')?.addEventListener('click', () => send({ type: 'ron' }));
  table.querySelector<HTMLButtonElement>('#pon')?.addEventListener('click', () => send({ type: 'pon' }));
  table.querySelector<HTMLButtonElement>('#chi')?.addEventListener('click', () => send({ type: 'chi' }));
  table.querySelector<HTMLButtonElement>('#kan')?.addEventListener('click', () => send({ type: 'kan' }));
  table.querySelector<HTMLButtonElement>('#nextRound')?.addEventListener('click', () => send({ type: 'next_round' }));
}

function renderResult(result: RoundResult) {
  const yaku = result.yaku?.map(y => `${y.name}${y.yakuman ? ` ${y.yakuman}倍役満` : ` ${y.han}翻`}`).join(' / ') || '';
  const score = result.yakuman ? `${result.yakuman}倍役満` : `${result.han ?? 0}翻`;
  return `
    <section class="result">
      <h2>${escapeHtml(result.message)}</h2>
      <p>${escapeHtml(score)}</p>
      <p>${escapeHtml(yaku)}</p>
    </section>
  `;
}

function renderMeld(meld: Meld) {
  return `<span class="meldTag">${meld.type.toUpperCase()} ${meld.tiles.map(tileLabel).join(' ')}</span>`;
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

function roundLabel(round: number) {
  const wind = round < 4 ? '東' : '南';
  return `${wind}${(round % 4) + 1}局`;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>'\"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[ch]!));
}
