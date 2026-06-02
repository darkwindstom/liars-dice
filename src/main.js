import './style.css';
import { io } from 'socket.io-client';

// ==========================================
// 1. WEB AUDIO API SYNTHESIZER
// ==========================================
class AudioController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(forceState) {
    this.enabled = forceState !== undefined ? forceState : !this.enabled;
    return this.enabled;
  }

  playShake(duration = 1.0) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Create white noise buffer
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter to make it sound like plastic/wood dice in a cup
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    // Modulate filter frequency slightly for texture
    filter.frequency.exponentialRampToValueAtTime(1000, now + duration);
    filter.Q.setValueAtTime(2.0, now);

    // Gain node for shaking envelope (rattling pattern)
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);

    // Generate rapid gain modulation to simulate multiple dice hitting each other
    let time = 0;
    while (time < duration) {
      const vol = 0.08 + Math.random() * 0.12;
      gainNode.gain.linearRampToValueAtTime(vol, now + time);
      gainNode.gain.linearRampToValueAtTime(0, now + time + 0.03);
      time += 0.06 + Math.random() * 0.05; // random intervals
    }
    gainNode.gain.setValueAtTime(0, now + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    noise.start(now);
  }

  playSlam() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low pitch thud oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.18);

    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);

    // Little noise burst for the impact click
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const click = ctx.createBufferSource();
    click.buffer = buffer;
    
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(1500, now);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(ctx.destination);

    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
    click.start(now);
  }

  playClick() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.frequency.setValueAtTime(900, now);
    gainNode.gain.setValueAtTime(0.03, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  playWinChime() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Arpeggio notes: C5, E5, G5, C6
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gainNode.gain.setValueAtTime(0.12, now + idx * 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }

  playLoseChime() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Descending sad chord: F#4, D4, B3
    const freqs = [369.99, 293.66, 246.94];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gainNode.gain.setValueAtTime(0.15, now + idx * 0.12);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  }
}

const audio = new AudioController();

// ==========================================
// 2. MATHEMATICAL PROBABILITY ASSISTANT
// ==========================================
// Binomial Coefficient: n Choose k
function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = res * (n - r + i) / i;
  }
  return Math.round(res);
}

// Probability of getting >= k successes in n trials, with success probability p
function binomialCumulativeProbability(n, k_needed, p) {
  if (k_needed <= 0) return 1.0;
  if (k_needed > n) return 0.0;
  
  let prob = 0.0;
  for (let i = k_needed; i <= n; i++) {
    prob += nCr(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  return prob;
}

// ==========================================
// 3. AI PERSONALITIES & DIALOGUE
// ==========================================
const AI_PHRASES = {
  sam: {
    name: '巴曼山姆 🧔',
    avatar: '🧔',
    desc: '理性分析、穩紮穩打。極少主動吹牛，主要依靠機率。',
    shaking: ['蓋好骰盅，看手氣。', '好戲準備開場。', '骰子滾動，點數底定。'],
    bidding: [
      (q, f) => `分析過後，我喊 ${q} 個 ${f}。`,
      (q, f) => `按合理推算，${q} 個 ${f} 是安全的。`,
      (q, f) => `那就 ${q} 個 ${f} 吧。`
    ],
    liar: [
      (q, f) => `別吹牛了，全場怎麼可能有 ${q} 個 ${f}？我劈！`,
      (q, f) => `概率太低了，${q} 個 ${f}？我不信。開！`
    ],
    lose: ['好吧，運氣也是概率的一環。', '我算錯了嗎？這不科學。'],
    win: ['理性，終將戰勝直覺。', '科學的勝利。']
  },
  tina: {
    name: '榮耀蒂娜 👩‍🎤',
    avatar: '👩‍🎤',
    desc: '攻守兼備。在安全範圍內偶爾虛張聲勢，判斷十分精確。',
    shaking: ['哼，看我搖個豹子！', '這杯子手感不錯。', '準備接受挑戰吧。'],
    bidding: [
      (q, f) => `加點碼，我出 ${q} 個 ${f}。`,
      (q, f) => `感覺全場差不多有這個數，${q} 個 ${f}。`,
      (q, f) => `輪到我了嗎？那就 ${q} 個 ${f}。`
    ],
    liar: [
      (q, f) => `你吹得太過火了！${q} 個 ${f}？開！`,
      (q, f) => `這點數一聽就是編的，我劈！`
    ],
    lose: ['算你狠，這把是我大意了。', '下次可沒這麼簡單！'],
    win: ['哈哈哈，早就被我識破了。', '這局是我的主場！']
  },
  jack: {
    name: '賭徒傑克 🤠',
    avatar: '🤠',
    desc: '狂野大膽。非常喜歡吹牛，甚至會喊出超出常規的點數。很少開別人，但很容易被劈。',
    shaking: ['刺激的來了！看好了！', '發財就看這一把。', '哈哈，搖得夠響！'],
    bidding: [
      (q, f) => `既然大家客氣，那我就喊 ${q} 個 ${f}！`,
      (q, f) => `大膽一點！${q} 個 ${f}，有種就劈我！`,
      (q, f) => `我跟你死磕！${q} 個 ${f}！`
    ],
    liar: [
      (q, f) => `我這人不信邪！${q} 個 ${f}？劈你！`,
      (q, f) => `想騙我？沒門！開！`
    ],
    lose: ['切，差一點就蒙混過關了。', '賭徒的字典裡沒有後退！輸得起！'],
    win: ['哈哈哈哈！富貴險中求！我贏了！', '這才叫賭局，你太嫩了！']
  }
};

// ==========================================
// 4. GAME STATE ENGINE
// ==========================================
class LiarDiceGame {
  constructor() {
    this.ruleMode = 'wild'; // 'wild' (Standard) or 'simple'
    this.initialDiceCount = 5;
    this.playerCount = 2; // Default 2 players
    
    this.players = [
      { id: 0, name: '你', avatar: '⚡', isAI: false, dice: [], diceCount: 5, isEliminated: false, isActive: true, personality: 'human' },
      { id: 1, name: '巴曼山姆', avatar: '🧔', isAI: true, dice: [], diceCount: 5, isEliminated: false, isActive: true, personality: 'sam' },
      { id: 2, name: '榮耀蒂娜', avatar: '👩‍🎤', isAI: true, dice: [], diceCount: 5, isEliminated: false, isActive: false, personality: 'tina' },
      { id: 3, name: '賭徒傑克', avatar: '🤠', isAI: true, dice: [], diceCount: 5, isEliminated: false, isActive: false, personality: 'jack' }
    ];

    this.currentTurn = 0; // index of active player
    this.lastBid = null; // { qty, face, bidderId }
    this.wild1sActive = true; // '1' is wild until someone bids on '1's
    this.gameState = 'LOBBY'; // LOBBY, ROLLING, BIDDING, REVEALED, GAMEOVER
    
    this.selectedFace = 2; // Default user bid face value selection

    // Multiplayer connection and parameters
    this.isMultiplayer = false;
    this.socket = null;
    this.roomCode = null;
    this.mySessionId = null;

    const socketUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    this.socket = io(socketUrl, { autoConnect: false });
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('connect', () => {
      this.mySessionId = this.socket.id;
      console.log('Connected to socket server. Session ID:', this.mySessionId);
    });

    this.socket.on('connect_error', () => {
      alert('連線伺服器失敗！請確認後端伺服器 (server.js) 是否正常運行於 Port 3000。');
      this.leaveRoomUI();
    });

    this.socket.on('roomCreated', ({ roomCode }) => {
      this.roomCode = roomCode;
      this.gameState = 'ROOM_LOBBY';
      document.getElementById('lobby-room-code-display').innerText = `房號: ${roomCode}`;
      this.showScreen('room-lobby-screen');
    });

    this.socket.on('roomJoined', ({ roomCode }) => {
      this.roomCode = roomCode;
      this.gameState = 'ROOM_LOBBY';
      document.getElementById('lobby-room-code-display').innerText = `房號: ${roomCode}`;
      this.showScreen('room-lobby-screen');
    });

    this.socket.on('joinError', (err) => {
      alert(err);
      this.leaveRoomUI();
    });

    this.socket.on('gameError', (err) => {
      alert(err);
    });

    this.socket.on('kicked', () => {
      alert('你已被房主移出房間！');
      this.leaveRoomUI();
    });

    this.socket.on('roomUpdated', (room) => {
      this.syncRoomState(room);
    });

    this.socket.on('gameStarted', () => {
      this.gameState = 'ROLLING';
      this.showScreen('game-screen');
      this.resetTableState();
      
      // Play shake sounds
      audio.playShake(1.2);
      this.players.forEach((p, idx) => {
        if (!p.isActive || p.isEliminated) return;
        const cup = document.getElementById(`cup-p${idx}`);
        if (cup) cup.classList.add('shaking');
        
        if (p.isAI) {
          this.showBubble(idx, this.getPhrase(p.personality, 'shaking'));
        } else {
          this.showBubble(idx, '骰子搖滾中... 🎲');
        }
      });
    });

    this.socket.on('biddingRoundStarted', () => {
      audio.playSlam();
      this.players.forEach((p, idx) => {
        const cup = document.getElementById(`cup-p${idx}`);
        if (cup) cup.classList.remove('shaking');
      });
      
      this.gameState = 'BIDDING';
      this.startTurn();
    });

    this.socket.on('bidUpdated', ({ lastBid, currentTurnIndex, wild1sActive }) => {
      console.log('DEBUG [bidUpdated]: Received from server:', { lastBid, currentTurnIndex, wild1sActive });
      this.lastBid = lastBid;
      console.log('DEBUG [bidUpdated]: this.players[0] and playerCount:', this.players[0], this.playerCount);
      const relativeTurnId = (currentTurnIndex - this.players[0].id + this.playerCount) % this.playerCount;
      this.currentTurn = relativeTurnId;
      this.wild1sActive = wild1sActive;

      // Update center display panel
      const bidder = this.players.find(pl => pl.id === lastBid.bidderId);
      console.log('DEBUG [bidUpdated]: Found bidder:', bidder, 'for bidderId:', lastBid.bidderId);
      if (bidder) {
        const bidPanel = document.getElementById('current-bid-panel');
        bidPanel.classList.remove('hidden');
        document.getElementById('active-bid-qty').innerText = lastBid.qty;
        document.getElementById('active-bid-face').innerHTML = this.getDiceHTML(lastBid.face, false);
        document.getElementById('active-bidder-name').innerText = bidder.name;
        
        const bidderRelativeIndex = this.players.findIndex(pl => pl.id === lastBid.bidderId);
        document.getElementById('active-bidder-name').style.color = this.getPlayerColor(bidderRelativeIndex);

        // Speak bubble
        let bubbleText;
        if (bidder.isAI) {
          bubbleText = this.getPhrase(bidder.personality, 'bidding', lastBid.qty, lastBid.face);
        } else {
          bubbleText = `我喊：${lastBid.qty} 個 ${lastBid.face}！`;
        }
        this.showBubble(bidderRelativeIndex, bubbleText);

        this.logMsg('action', bidderRelativeIndex, `喊注了： ${lastBid.qty} 個 ${this.getDiceHTML(lastBid.face, false, 'chat-die')}`);
      }
      
      audio.playClick();
      this.startTurn();
    });

    this.socket.on('challengeResolved', (data) => {
      this.gameState = 'REVEALED';
      this.handleSyncedChallenge(data);
    });

    this.socket.on('gameFinished', ({ winnerName }) => {
      this.gameState = 'GAMEOVER';
      
      const chatLog = document.getElementById('game-chat-log');
      chatLog.innerHTML += `<div class="chat-msg system" style="font-size:1.1rem; border:2px solid var(--accent-gold); background:rgba(245, 158, 11, 0.08);">🏆 遊戲結束！恭喜【${winnerName}】獲得最終勝利！</div>`;
      
      alert(`🏆 遊戲結束！恭喜【${winnerName}】獲得最終勝利！`);
      this.leaveRoomUI();
    });
  }

  syncRoomState(room) {
    this.ruleMode = room.ruleMode;
    this.initialDiceCount = room.initialDiceCount;

    const isOwner = room.owner === this.mySessionId;
    document.getElementById('rule-badge').innerText = this.ruleMode === 'wild' ? '標準模式' : '簡單模式';
    
    // Update lobby player list UI
    const lobbyPlayersList = document.getElementById('lobby-players-list');
    const lobbyPlayerCount = document.getElementById('lobby-player-count');
    
    if (lobbyPlayerCount) lobbyPlayerCount.innerText = room.players.length;
    
    if (lobbyPlayersList) {
      lobbyPlayersList.innerHTML = '';
      room.players.forEach(p => {
        const isHost = room.owner === p.socketId;
        const isMe = p.socketId === this.mySessionId;
        const hostTag = isHost ? '<span class="host-badge">房主 👑</span>' : '';
        const meTag = isMe ? ' (你)' : '';
        
        let kickButton = '';
        if (isOwner && !isMe) {
          kickButton = `<button class="kick-btn" data-player-id="${p.id}" type="button">踢出 👢</button>`;
        }

        const row = document.createElement('div');
        row.className = 'lobby-player-row';
        row.innerHTML = `
          <div class="player-info">
            <span class="avatar">${p.avatar}</span>
            <span class="name">${p.name}${hostTag}${meTag}</span>
          </div>
          ${kickButton}
        `;
        lobbyPlayersList.appendChild(row);
      });

      // Add Kick handlers
      lobbyPlayersList.querySelectorAll('.kick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = parseInt(e.currentTarget.dataset.playerId);
          this.socket.emit('kickPlayer', { roomCode: this.roomCode, playerId: id });
        });
      });
    }

    // Toggle owner settings interface panels
    const ownerControls = document.getElementById('lobby-owner-controls');
    const guestView = document.getElementById('lobby-guest-view');
    const startGameBtn = document.getElementById('lobby-start-game-btn');
    const guestWaitBtn = document.getElementById('lobby-guest-wait-btn');
    const addAiPanel = document.getElementById('lobby-add-ai-panel');

    if (isOwner) {
      if (ownerControls) ownerControls.style.display = 'block';
      if (guestView) guestView.style.display = 'none';
      if (startGameBtn) {
        startGameBtn.style.display = 'block';
        if (room.players.length >= 2) {
          startGameBtn.removeAttribute('disabled');
          startGameBtn.classList.remove('disabled');
        } else {
          startGameBtn.setAttribute('disabled', 'true');
          startGameBtn.classList.add('disabled');
        }
      }
      if (guestWaitBtn) guestWaitBtn.classList.add('hidden');
      if (addAiPanel) addAiPanel.classList.remove('hidden');

      // Sync rules steppers on UI
      const lobbyInitialDiceVal = document.getElementById('lobby-initial-dice-val');
      if (lobbyInitialDiceVal) lobbyInitialDiceVal.innerText = room.initialDiceCount;

      const radWild = document.getElementById('lobby-rule-wild-label');
      const radSimple = document.getElementById('lobby-rule-simple-label');
      if (radWild && radSimple) {
        if (room.ruleMode === 'wild') {
          radWild.classList.add('active');
          radSimple.classList.remove('active');
          radWild.querySelector('input').checked = true;
        } else {
          radSimple.classList.add('active');
          radWild.classList.remove('active');
          radSimple.querySelector('input').checked = true;
        }
      }
    } else {
      if (ownerControls) ownerControls.style.display = 'none';
      if (guestView) guestView.style.display = 'block';
      if (startGameBtn) startGameBtn.style.display = 'none';
      if (guestWaitBtn) guestWaitBtn.classList.remove('hidden');
      if (addAiPanel) addAiPanel.classList.add('hidden');

      const guestRule = document.getElementById('lobby-guest-rule-display');
      const guestDice = document.getElementById('lobby-guest-dice-display');
      if (guestRule) guestRule.innerText = room.ruleMode === 'wild' ? '標準模式 (1點為變子)' : '簡單模式 (1點不變)';
      if (guestDice) guestDice.innerText = `${room.initialDiceCount} 顆`;
    }

    // Now, Sync player profiles on the Game Screen circular table!
    const myPlayer = room.players.find(p => p.socketId === this.mySessionId);
    if (!myPlayer) return;

    const myRoomIndex = room.players.findIndex(p => p.socketId === this.mySessionId);
    this.playerCount = room.players.length;

    const seats = [
      document.getElementById('seat-player-0'),
      document.getElementById('seat-player-1'),
      document.getElementById('seat-player-2'),
      document.getElementById('seat-player-3')
    ];

    seats.forEach(s => {
      if (s) {
        s.classList.remove('player-left', 'player-top', 'player-right', 'player-bottom');
        s.style.display = 'none';
      }
    });

    this.players.forEach(p => {
      p.isActive = false;
      p.isEliminated = true;
    });

    room.players.forEach((p, idx) => {
      const relativeSeatId = (idx - myRoomIndex + room.players.length) % room.players.length;
      const localPlayer = this.players[relativeSeatId];
      if (localPlayer) {
        localPlayer.id = p.id;
        localPlayer.name = p.name;
        localPlayer.avatar = p.avatar;
        localPlayer.isAI = p.isAI;
        localPlayer.personality = p.personality;
        localPlayer.diceCount = p.diceCount;
        localPlayer.isEliminated = p.isEliminated;
        localPlayer.isActive = true;
        localPlayer.dice = p.dice;
      }

      const seatElement = document.getElementById(`seat-player-${relativeSeatId}`);
      if (seatElement) {
        seatElement.style.display = 'flex';
        
        if (room.players.length === 2) {
          if (relativeSeatId === 0) seatElement.classList.add('player-bottom');
          if (relativeSeatId === 1) seatElement.classList.add('player-top');
        } else if (room.players.length === 3) {
          if (relativeSeatId === 0) seatElement.classList.add('player-bottom');
          if (relativeSeatId === 1) seatElement.classList.add('player-left');
          if (relativeSeatId === 2) seatElement.classList.add('player-right');
        } else if (room.players.length === 4) {
          if (relativeSeatId === 0) seatElement.classList.add('player-bottom');
          if (relativeSeatId === 1) seatElement.classList.add('player-left');
          if (relativeSeatId === 2) seatElement.classList.add('player-top');
          if (relativeSeatId === 3) seatElement.classList.add('player-right');
        }

        const badge = document.getElementById(`badge-p${relativeSeatId}`);
        if (badge) {
          badge.innerText = p.diceCount;
          badge.style.display = p.isEliminated ? 'none' : 'flex';
        }

        const avatarRing = seatElement.querySelector('.avatar-ring');
        const avatarDiv = seatElement.querySelector('.avatar');
        const nameSpan = seatElement.querySelector('.player-name');

        if (nameSpan) nameSpan.innerText = p.name;
        if (avatarDiv) avatarDiv.innerText = p.isEliminated ? '💀' : p.avatar;

        if (p.isEliminated) {
          seatElement.classList.add('eliminated');
        } else {
          seatElement.classList.remove('eliminated');
        }
      }
    });

    const relativeTurnId = (room.currentTurnIndex - myRoomIndex + room.players.length) % room.players.length;
    this.currentTurn = relativeTurnId;

    seats.forEach(s => {
      if (s) s.classList.remove('active-turn');
    });
    if (room.gameState === 'BIDDING') {
      const activeSeat = document.getElementById(`seat-player-${relativeTurnId}`);
      if (activeSeat) activeSeat.classList.add('active-turn');
      
      const activePlayer = room.players[room.currentTurnIndex];
      document.getElementById('table-status-label').innerText = `輪到 ${activePlayer.name}`;
    }

    // Render my dice hand on the left panel
    const p0 = this.players[0];
    if (p0.isActive && !p0.isEliminated && room.gameState !== 'LOBBY') {
      const tableHandPanel = document.getElementById('table-my-hand-panel');
      if (tableHandPanel) {
        tableHandPanel.classList.remove('hidden');
      }
      const tableHandDice = document.getElementById('table-my-hand-dice');
      const miniDice = document.getElementById('my-mini-dice');
      
      if (tableHandDice && p0.dice && p0.dice.length > 0) {
        tableHandDice.innerHTML = '';
        p0.dice.forEach(val => {
          tableHandDice.innerHTML += this.getDiceHTML(val, false, 'die');
        });
      }

      if (miniDice && p0.dice && p0.dice.length > 0) {
        miniDice.innerHTML = '';
        p0.dice.forEach(val => {
          miniDice.innerHTML += this.getDiceHTML(val, false, 'die');
        });
      }
    }
  }

  handleSyncedChallenge(data) {
    const challenger = this.players.find(p => p.id === data.challengerId);
    const bidder = this.players.find(p => p.id === data.bidderId);
    const winner = this.players.find(p => p.id === data.winnerId);
    const loser = this.players.find(p => p.id === data.loserId);
    
    if (!challenger || !bidder || !winner || !loser) return;

    const bidQty = data.bidQty;
    const bidFace = data.bidFace;
    const totalMatching = data.totalMatching;
    const isBidSuccessful = data.isBidSuccessful;

    const challengerRelativeId = this.players.findIndex(p => p.id === data.challengerId);
    let challengerBubble;
    if (challenger.isAI) {
      challengerBubble = this.getPhrase(challenger.personality, 'liar', bidQty, bidFace);
    } else {
      challengerBubble = `不信你！開！🫵`;
    }
    this.showBubble(challengerRelativeId, challengerBubble);

    this.logMsg('system', `🔔 ${challenger.name} 劈了 ${bidder.name} 的喊注 ( ${bidQty} 個 [${bidFace}] )！揭開所有骰盅！`);

    // Lift cups
    this.players.forEach((p, idx) => {
      if (!p.isActive || p.isEliminated) return;
      const cup = document.getElementById(`cup-p${idx}`);
      if (cup) cup.classList.add('lifted');
      
      const diceDiv = document.getElementById(`dice-p${idx}`);
      if (diceDiv) diceDiv.innerHTML = '';
    });

    // Populate modal dice reveal row
    const revealContainer = document.getElementById('dice-reveal-container');
    revealContainer.innerHTML = '';

    this.players.filter(p => p.isActive).forEach(p => {
      const relativeIndex = this.players.findIndex(pl => pl.id === p.id);
      let pDiceHTML = '';
      if (!p.isEliminated) {
        p.dice.forEach(val => {
          const isMatch = (val === bidFace) || (this.ruleMode === 'wild' && this.wild1sActive && val === 1);
          const extraClass = 'die' + (isMatch ? ' highlight' : '');
          pDiceHTML += this.getDiceHTML(val, relativeIndex !== 0, extraClass);
        });
      } else {
        pDiceHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">已被淘汰</span>`;
      }

      const row = document.createElement('div');
      row.className = `reveal-row ${p.isAI ? 'ai-p' + relativeIndex : 'player'} ${p.isEliminated ? 'eliminated' : ''}`;
      row.innerHTML = `
        <span class="name">${p.name}</span>
        <div class="dice">${pDiceHTML}</div>
        <span style="font-weight:700;">${p.isEliminated ? '-' : p.dice.filter(val => val === bidFace || (this.ruleMode === 'wild' && this.wild1sActive && val === 1)).length + ' 個'}</span>
      `;
      revealContainer.appendChild(row);
    });

    const resultTitle = document.getElementById('result-title');
    const resultSummary = document.getElementById('result-summary');
    const resultMath = document.getElementById('result-math-details');

    resultTitle.innerText = isBidSuccessful ? '挑戰失敗！' : '挑戰成功！';
    resultTitle.style.color = isBidSuccessful ? 'var(--accent-rose)' : 'var(--accent-emerald)';

    const winnerRelativeId = this.players.findIndex(p => p.id === data.winnerId);
    const loserRelativeId = this.players.findIndex(p => p.id === data.loserId);

    resultSummary.innerHTML = `
      <span class="player" style="color:${this.getPlayerColor(winnerRelativeId)}">${winner.name}</span> 贏得本局！<br>
      <span class="player" style="color:${this.getPlayerColor(loserRelativeId)}">${loser.name}</span> 喊注或劈牌失敗！<br>
      全場共有 <span class="qty">${totalMatching}</span> 個 <span class="resolution-summary-die">${this.getDiceHTML(bidFace, false)}</span> (包含 1點變子：${this.ruleMode === 'wild' && this.wild1sActive ? '開' : '關'})。<br>
      上一手喊注為 <span class="qty">${bidQty}</span> 個，實際點數 ${isBidSuccessful ? '足夠' : '不足'}。
    `;

    resultMath.innerHTML = `
      本局不扣除骰子。剩餘骰子：${loser.diceCount} 顆。
    `;

    const isMeWinner = data.winnerId === this.players[0].id;
    const isMeLoser = data.loserId === this.players[0].id;
    if (isMeLoser) {
      audio.playLoseChime();
    } else if (isMeWinner) {
      audio.playWinChime();
    } else {
      audio.playClick();
    }

    setTimeout(() => {
      this.showBubble(loserRelativeId, this.getPhrase(loser.personality, 'lose'));
      this.showBubble(winnerRelativeId, this.getPhrase(winner.personality, 'win'));
    }, 1000);

    setTimeout(() => {
      document.getElementById('result-modal').classList.add('active');
    }, 2200);

    this.logMsg('system', `🏁 本局結束：全場共有 ${totalMatching} 個 [${bidFace}]。${winner.name} 勝出，${loser.name} 失去一顆骰子。`);
  }

  leaveRoomUI() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leaveRoom', { roomCode: this.roomCode });
      this.socket.disconnect();
    }
    this.roomCode = null;
    this.gameState = 'LOBBY';
    this.isMultiplayer = false;
    
    // Default back to Single player UI
    document.getElementById('mode-single-btn').click();
    this.showScreen('lobby-screen');
  }

  initUI() {
    // Mode toggles
    const modeSingleBtn = document.getElementById('mode-single-btn');
    const modeMultiBtn = document.getElementById('mode-multi-btn');
    const singleSettings = document.getElementById('single-player-settings');
    const multiSettings = document.getElementById('multiplayer-settings');

    modeSingleBtn.addEventListener('click', () => {
      audio.playClick();
      modeSingleBtn.classList.add('active-mode');
      modeMultiBtn.classList.remove('active-mode');
      singleSettings.style.display = 'block';
      multiSettings.style.display = 'none';
      this.isMultiplayer = false;
    });

    modeMultiBtn.addEventListener('click', () => {
      audio.playClick();
      modeMultiBtn.classList.add('active-mode');
      modeSingleBtn.classList.remove('active-mode');
      multiSettings.style.display = 'block';
      singleSettings.style.display = 'none';
      this.isMultiplayer = true;
      
      // Connect to server on toggle
      if (!this.socket.connected) {
        this.socket.connect();
      }
    });

    // Multiplayer buttons: Create & Join
    document.getElementById('create-room-btn').addEventListener('click', () => {
      audio.playClick();
      const nicknameInput = document.getElementById('player-nickname-input');
      const nickname = nicknameInput.value.trim() || '玩家1';
      this.players[0].name = nickname;
      this.socket.emit('createRoom', { playerName: nickname });
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
      audio.playClick();
      const nicknameInput = document.getElementById('player-nickname-input');
      const nickname = nicknameInput.value.trim() || '玩家1';
      
      const codeInput = document.getElementById('join-room-input');
      const code = codeInput.value.trim();
      if (code.length !== 4) {
        alert('請輸入正確的 4 位數房號！');
        return;
      }
      
      this.players[0].name = nickname;
      this.socket.emit('joinRoom', { roomCode: code, playerName: nickname });
    });

    // Room Lobby actions: Add AI, Settings, Start, Leave
    document.querySelectorAll('.add-ai-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.playClick();
        const personality = e.currentTarget.dataset.personality;
        this.socket.emit('addAI', { roomCode: this.roomCode, personality });
      });
    });

    const lobbyRuleWild = document.getElementById('lobby-rule-wild-label');
    const lobbyRuleSimple = document.getElementById('lobby-rule-simple-label');
    
    if (lobbyRuleWild && lobbyRuleSimple) {
      lobbyRuleWild.addEventListener('click', () => {
        lobbyRuleWild.classList.add('active');
        lobbyRuleSimple.classList.remove('active');
        this.socket.emit('updateSettings', {
          roomCode: this.roomCode,
          ruleMode: 'wild',
          initialDiceCount: parseInt(document.getElementById('lobby-initial-dice-val').innerText)
        });
      });

      lobbyRuleSimple.addEventListener('click', () => {
        lobbyRuleSimple.classList.add('active');
        lobbyRuleWild.classList.remove('active');
        this.socket.emit('updateSettings', {
          roomCode: this.roomCode,
          ruleMode: 'simple',
          initialDiceCount: parseInt(document.getElementById('lobby-initial-dice-val').innerText)
        });
      });
    }

    document.getElementById('lobby-dice-dec-btn').addEventListener('click', () => {
      audio.playClick();
      let val = parseInt(document.getElementById('lobby-initial-dice-val').innerText);
      if (val > 2) {
        val--;
        document.getElementById('lobby-initial-dice-val').innerText = val;
        
        const ruleVal = document.querySelector('input[name="lobby-game-rule"]:checked').value;
        this.socket.emit('updateSettings', {
          roomCode: this.roomCode,
          ruleMode: ruleVal,
          initialDiceCount: val
        });
      }
    });

    document.getElementById('lobby-dice-inc-btn').addEventListener('click', () => {
      audio.playClick();
      let val = parseInt(document.getElementById('lobby-initial-dice-val').innerText);
      if (val < 8) {
        val++;
        document.getElementById('lobby-initial-dice-val').innerText = val;
        
        const ruleVal = document.querySelector('input[name="lobby-game-rule"]:checked').value;
        this.socket.emit('updateSettings', {
          roomCode: this.roomCode,
          ruleMode: ruleVal,
          initialDiceCount: val
        });
      }
    });

    document.getElementById('leave-room-btn').addEventListener('click', () => {
      audio.playClick();
      this.leaveRoomUI();
    });

    document.getElementById('lobby-start-game-btn').addEventListener('click', () => {
      audio.init();
      audio.playClick();
      this.socket.emit('startGame', { roomCode: this.roomCode });
    });

    // Lobby UI Hookups for Single Player
    document.getElementById('start-game-btn').addEventListener('click', () => {
      audio.init();
      audio.playClick();
      
      const nicknameInput = document.getElementById('player-nickname-input');
      const nickname = nicknameInput.value.trim() || '你';
      this.players[0].name = nickname;
      
      this.startGame();
    });

    // Rule selectors (Single Player)
    const wildLabel = document.getElementById('rule-wild-label');
    const simpleLabel = document.getElementById('rule-simple-label');
    wildLabel.addEventListener('click', () => {
      wildLabel.classList.add('active');
      simpleLabel.classList.remove('active');
      this.ruleMode = 'wild';
    });
    simpleLabel.addEventListener('click', () => {
      simpleLabel.classList.add('active');
      wildLabel.classList.remove('active');
      this.ruleMode = 'simple';
    });

    // Player count selector stepper (Single Player)
    document.getElementById('player-count-dec-btn').addEventListener('click', () => {
      audio.playClick();
      if (this.playerCount > 2) {
        this.playerCount--;
        document.getElementById('player-count-val').innerText = this.playerCount;
      }
    });
    document.getElementById('player-count-inc-btn').addEventListener('click', () => {
      audio.playClick();
      if (this.playerCount < 4) {
        this.playerCount++;
        document.getElementById('player-count-val').innerText = this.playerCount;
      }
    });

    // Initial dice counter stepper (Single Player)
    document.getElementById('dice-dec-btn').addEventListener('click', () => {
      audio.playClick();
      if (this.initialDiceCount > 2) {
        this.initialDiceCount--;
        document.getElementById('initial-dice-val').innerText = this.initialDiceCount;
      }
    });
    document.getElementById('dice-inc-btn').addEventListener('click', () => {
      audio.playClick();
      if (this.initialDiceCount < 8) {
        this.initialDiceCount++;
        document.getElementById('initial-dice-val').innerText = this.initialDiceCount;
      }
    });

    // Header buttons
    document.getElementById('sound-toggle-btn').addEventListener('click', (e) => {
      const isEnabled = audio.toggle();
      e.currentTarget.innerHTML = isEnabled ? '🔊' : '🔇';
      audio.playClick();
    });

    const rulesModal = document.getElementById('rules-modal');
    document.getElementById('open-rules-btn').addEventListener('click', () => {
      audio.playClick();
      rulesModal.classList.add('active');
    });
    document.getElementById('close-rules-btn').addEventListener('click', () => {
      audio.playClick();
      rulesModal.classList.remove('active');
    });
    document.getElementById('rules-backdrop').addEventListener('click', () => {
      rulesModal.classList.remove('active');
    });

    document.getElementById('quit-game-btn').addEventListener('click', () => {
      audio.playClick();
      if (confirm('確定要退出遊戲回到大廳嗎？你的遊戲進度將會遺失。')) {
        if (this.isMultiplayer) {
          this.leaveRoomUI();
        } else {
          this.gameState = 'LOBBY';
          this.showScreen('lobby-screen');
        }
      }
    });

    // Table Center Action buttons
    document.getElementById('roll-dice-btn').addEventListener('click', () => {
      this.rollRound();
    });

    // Player panel actions
    document.getElementById('action-liar-btn').addEventListener('click', () => {
      this.handleChallenge();
    });
    document.getElementById('action-bid-btn').addEventListener('click', () => {
      this.handleHumanBid();
    });

    // Steppers inside Action panel
    document.getElementById('bid-qty-dec').addEventListener('click', () => {
      audio.playClick();
      const input = document.getElementById('bid-qty-input');
      let val = parseInt(input.value);
      const minVal = this.getMinBidQuantity(this.selectedFace);
      if (val > minVal) {
        val--;
        input.value = val;
        this.updateProbabilityHelper();
      }
    });
    document.getElementById('bid-qty-inc').addEventListener('click', () => {
      audio.playClick();
      const input = document.getElementById('bid-qty-input');
      let val = parseInt(input.value);
      val++;
      input.value = val;
      this.updateProbabilityHelper();
    });

    // Dice Face selectors
    const faceButtons = document.querySelectorAll('.dice-face-selectors .face-btn');
    faceButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.playClick();
        faceButtons.forEach(b => b.classList.remove('active'));
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active');
        this.selectedFace = parseInt(targetBtn.dataset.face);
        
        const minQty = this.getMinBidQuantity(this.selectedFace);
        const input = document.getElementById('bid-qty-input');
        if (parseInt(input.value) < minQty) {
          input.value = minQty;
        }
        this.updateProbabilityHelper();
      });
    });

    // Next Round modal button
    document.getElementById('next-round-btn').addEventListener('click', () => {
      audio.playClick();
      document.getElementById('result-modal').classList.remove('active');
      
      if (this.isMultiplayer) {
        this.socket.emit('nextRound', { roomCode: this.roomCode });
      } else {
        this.prepareNextRound();
      }
    });
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  startGame() {
    this.gameState = 'ROLLING';
    this.showScreen('game-screen');
    
    // Set headers & config
    document.getElementById('rule-badge').innerText = this.ruleMode === 'wild' ? '標準模式' : '簡單模式';
    
    // Reset players
    this.players.forEach(p => {
      p.isActive = p.id < this.playerCount;
      p.diceCount = this.initialDiceCount;
      p.isEliminated = false;
      p.dice = [];
    });

    // Dynamically adjust seating position classes to balance the circular layout
    const seat0 = document.getElementById('seat-player-0');
    const seat1 = document.getElementById('seat-player-1');
    const seat2 = document.getElementById('seat-player-2');
    const seat3 = document.getElementById('seat-player-3');
    
    [seat0, seat1, seat2, seat3].forEach(s => {
      if (s) {
        s.classList.remove('player-left', 'player-top', 'player-right', 'player-bottom');
      }
    });

    seat0.classList.add('player-bottom'); // Human always at bottom
    
    if (this.playerCount === 2) {
      seat1.classList.add('player-top');
    } else if (this.playerCount === 3) {
      seat1.classList.add('player-left');
      seat2.classList.add('player-right');
    } else if (this.playerCount === 4) {
      seat1.classList.add('player-left');
      seat2.classList.add('player-top');
      seat3.classList.add('player-right');
    }

    // Clear UI logs
    const chatLog = document.getElementById('game-chat-log');
    chatLog.innerHTML = `<div class="chat-msg system">進入霓虹酒吧。每位玩家有 ${this.initialDiceCount} 顆骰子。遊戲人數：${this.playerCount} 人。請點擊「搖骰」開始！</div>`;

    this.currentTurn = 0; // Player starts first
    this.lastBid = null;
    this.wild1sActive = true;

    this.updateLobbyDiceCounts();
    this.resetTableState();
  }

  // Prepares UI between rounds
  resetTableState() {
    // Hide cups or bring down
    document.querySelectorAll('.cup').forEach(c => {
      c.className = 'cup'; // removes shaking/lifted classes
    });
    // Clear hands
    document.querySelectorAll('.hidden-dice').forEach(d => {
      d.innerHTML = '';
    });
    
    // Hide Center Bid Panel
    document.getElementById('current-bid-panel').classList.add('hidden');
    
    // Hide table hand panel
    const tableHandPanel = document.getElementById('table-my-hand-panel');
    if (tableHandPanel) {
      tableHandPanel.classList.add('hidden');
    }
    
    // Show Roll Button (Only in Single Player)
    const rollBtn = document.getElementById('roll-dice-btn');
    if (rollBtn) {
      if (this.isMultiplayer) {
        rollBtn.style.display = 'none';
      } else {
        rollBtn.style.display = 'block';
        rollBtn.classList.add('pulse');
      }
    }
    
    // Disable Bidding Panel
    document.getElementById('player-action-panel').classList.add('disabled');
    
    document.getElementById('table-status-label').innerText = '準備搖骰';
    document.getElementById('eval-bid-display').innerText = '無';
    document.getElementById('prob-percentage').innerText = '0';
    document.getElementById('prob-ring').style.strokeDashoffset = '251.2';
    document.getElementById('prob-explanation').innerText = '等待有人喊注...';

    // Clear active turn lights
    document.querySelectorAll('.player-seat').forEach(s => s.classList.remove('active-turn'));
  }

  updateLobbyDiceCounts() {
    this.players.forEach((p, idx) => {
      const badge = document.getElementById(`badge-p${idx}`);
      const seat = document.getElementById(`seat-player-${idx}`);
      
      if (!p.isActive) {
        if (badge) badge.style.display = 'none';
        if (seat) seat.style.display = 'none';
        return;
      }
      
      if (badge) {
        badge.innerText = p.diceCount;
        badge.style.display = p.isEliminated ? 'none' : 'flex';
      }
      
      if (seat) {
        seat.style.display = 'flex';
        if (p.isEliminated) {
          seat.classList.add('eliminated');
          seat.querySelector('.avatar').innerText = '💀';
        } else {
          seat.classList.remove('eliminated');
          // Restore original avatars
          if (p.personality === 'sam') seat.querySelector('.avatar').innerText = '🧔';
          else if (p.personality === 'tina') seat.querySelector('.avatar').innerText = '👩‍🎤';
          else if (p.personality === 'jack') seat.querySelector('.avatar').innerText = '🤠';
          else seat.querySelector('.avatar').innerText = '⚡';
        }
      }
    });
  }

  // ==========================================
  // ROUND ROLL & SHAKE PHASE
  // ==========================================
  rollRound() {
    this.gameState = 'ROLLING';
    audio.playShake(1.2);

    // Hide Roll Button
    document.getElementById('roll-dice-btn').style.display = 'none';
    document.getElementById('table-status-label').innerText = '正在搖骰...';

    // UI Cup Shaking Animations
    this.players.forEach(p => {
      if (!p.isActive || p.isEliminated) return;
      const cup = document.getElementById(`cup-p${p.id}`);
      if (cup) cup.classList.add('shaking');

      // Speak some random trash talk/setup
      this.showBubble(p.id, this.getPhrase(p.personality, 'shaking'));
    });

    // Timeout to simulate physical rolling duration
    setTimeout(() => {
      audio.playSlam();
      
      // Stop shaking
      this.players.forEach(p => {
        if (!p.isActive || p.isEliminated) return;
        const cup = document.getElementById(`cup-p${p.id}`);
        if (cup) cup.classList.remove('shaking');
      });

      // Roll actual dice values and handle re-rolls for "no duplicate points" (散牌)
      this.players.forEach(p => {
        if (!p.isActive || p.isEliminated) return;
        
        let attempts = 0;
        let isStraight = false;
        
        do {
          p.dice = [];
          for (let i = 0; i < p.diceCount; i++) {
            p.dice.push(Math.floor(Math.random() * 6) + 1);
          }
          p.dice.sort((a,b) => a-b);
          
          // Check if straight / unique faces (only if dice count > 1)
          if (p.diceCount > 1 && new Set(p.dice).size === p.dice.length) {
            isStraight = true;
            attempts++;
            this.logMsg('system', `🔄 ${p.name} 搖出散牌(無重複點數)：${p.dice.join(', ')}。依規則重新搖骰！`);
            if (p.id === 0) {
              this.showBubble(p.id, `沒有對子！重新搖！🎲`);
            } else {
              this.showBubble(p.id, `沒重複，重來！`);
            }
          } else {
            isStraight = false;
          }
        } while (isStraight);
      });

      this.logMsg('system', '🎲 所有玩家已搖好骰子！骰盅蓋定。');

      // Render human player's dice under cup (always visible to player 0)
      this.renderPlayer0Dice();

      // Show table hand panel
      const tableHandPanel = document.getElementById('table-my-hand-panel');
      if (tableHandPanel) {
        tableHandPanel.classList.remove('hidden');
      }

      // Clear last bids
      this.lastBid = null;
      this.wild1sActive = this.ruleMode === 'wild';
      
      // Select first turn player (the loser of the last round, or player 0 if first game)
      if (this.currentTurn >= this.players.length || !this.players[this.currentTurn].isActive || this.players[this.currentTurn].isEliminated) {
        this.currentTurn = this.players.findIndex(p => p.isActive && !p.isEliminated);
      }

      this.gameState = 'BIDDING';
      this.startTurn();
    }, 1200);
  }

  renderPlayer0Dice() {
    const p0 = this.players[0];
    if (p0.isEliminated) return;

    // Render in probability helper bar too
    const miniDice = document.getElementById('my-mini-dice');
    if (miniDice) {
      miniDice.innerHTML = '';
      p0.dice.forEach(val => {
        miniDice.innerHTML += this.getDiceHTML(val, false, 'die');
      });
    }

    // Render in table left hand panel too
    const tableHandDice = document.getElementById('table-my-hand-dice');
    if (tableHandDice) {
      tableHandDice.innerHTML = '';
      p0.dice.forEach(val => {
        tableHandDice.innerHTML += this.getDiceHTML(val, false, 'die');
      });
    }
  }

  // ==========================================
  // TURN SYSTEM
  // ==========================================
  startTurn() {
    if (this.gameState !== 'BIDDING') return;

    // Highlight active player
    document.querySelectorAll('.player-seat').forEach(s => s.classList.remove('active-turn'));
    const seat = document.getElementById(`seat-player-${this.currentTurn}`);
    if (seat) seat.classList.add('active-turn');

    const activePlayer = this.players[this.currentTurn];
    document.getElementById('table-status-label').innerText = `輪到 ${activePlayer.name}`;

    if (this.currentTurn === 0) {
      // Local player's turn
      document.getElementById('player-action-panel').classList.remove('disabled');
      this.setupHumanBiddingLimits();
    } else {
      // Not local player's turn
      document.getElementById('player-action-panel').classList.add('disabled');
      
      // Only schedule AI decision locally if in Single Player offline mode
      if (!this.isMultiplayer && activePlayer.isAI) {
        const delay = 1500 + Math.random() * 1500;
        setTimeout(() => {
          this.runAIDecision(activePlayer);
        }, delay);
      }
    }
  }

  nextTurn() {
    do {
      this.currentTurn = (this.currentTurn + 1) % this.players.length;
    } while (!this.players[this.currentTurn].isActive || this.players[this.currentTurn].isEliminated);
    
    this.startTurn();
  }

  // Set minimum limits on Human bidding sliders based on previous bids
  setupHumanBiddingLimits() {
    const qtyInput = document.getElementById('bid-qty-input');
    
    // Default current selection face in button
    const faceButtons = document.querySelectorAll('.dice-face-selectors .face-btn');
    faceButtons.forEach(b => {
      const face = parseInt(b.dataset.face);
      b.classList.remove('active');
      if (face === this.selectedFace) {
        b.classList.add('active');
      }
    });

    // Check if 1 is wild and disable/adjust style on '1' button accordingly
    const btn1 = document.getElementById('btn-face-1');
    if (!this.wild1sActive && this.ruleMode === 'wild') {
      btn1.style.textDecoration = 'line-through';
      btn1.style.opacity = '0.6';
      btn1.title = '「1點」已在此局被喊過，失去萬能屬性';
    } else {
      btn1.style.textDecoration = 'none';
      btn1.style.opacity = '1';
      btn1.title = this.ruleMode === 'wild' ? '1點為萬能牌' : '1點普通牌';
    }

    // Set initial value for stepper based on previous bid
    const minQty = this.getMinBidQuantity(this.selectedFace);
    if (parseInt(qtyInput.value) < minQty) {
      qtyInput.value = minQty;
    }

    // Hide or Show "Liar" button
    const liarBtn = document.getElementById('action-liar-btn');
    if (this.lastBid === null) {
      liarBtn.style.display = 'none'; // Cannot challenge on first turn
    } else {
      liarBtn.style.display = 'block';
    }

    this.updateProbabilityHelper();
  }

  getMinBidQuantity(face) {
    if (this.lastBid === null) return 2; // minimum bid is two of anything
    
    const prevQty = this.lastBid.qty;
    const prevFace = this.lastBid.face;

    if (face > prevFace) {
      return prevQty; // Same quantity is allowed if face value is higher
    } else {
      return prevQty + 1; // Must increment quantity if face value is equal or lower
    }
  }

  // ==========================================
  // BID & CHALLENGE RESOLUTION
  // ==========================================
  handleBid(qty, face, bidderId) {
    const bidder = this.players[bidderId];
    
    // Check if bidding on 1s
    if (this.ruleMode === 'wild' && face === 1 && this.wild1sActive) {
      this.wild1sActive = false;
      this.logMsg('system', '⚠️ 警告：「1點」已被喊過！在此局中「1點」不再代表任何變子。');
    }

    this.lastBid = { qty, face, bidderId };

    // Update center display panel
    const bidPanel = document.getElementById('current-bid-panel');
    bidPanel.classList.remove('hidden');
    document.getElementById('active-bid-qty').innerText = qty;
    document.getElementById('active-bid-face').innerHTML = this.getDiceHTML(face, false);
    document.getElementById('active-bidder-name').innerText = bidder.name;
    document.getElementById('active-bidder-name').style.color = this.getPlayerColor(bidderId);

    // Speak bubble
    let bubbleText;
    if (bidder.isAI) {
      bubbleText = this.getPhrase(bidder.personality, 'bidding', qty, face);
    } else {
      bubbleText = `我喊：${qty} 個 ${face}！`;
    }
    this.showBubble(bidderId, bubbleText);
    this.logMsg('action', bidderId, `喊注了： ${qty} 個 ${this.getDiceHTML(face, false, 'chat-die')}`);

    audio.playClick();
    this.nextTurn();
  }

  handleHumanBid() {
    const qtyInput = document.getElementById('bid-qty-input');
    const qty = parseInt(qtyInput.value);
    const face = this.selectedFace;

    // Validate
    const minQty = this.getMinBidQuantity(face);
    if (qty < minQty) {
      alert(`無效的喊注！必須高於前一位的喊注。當你喊點數 [${face}] 時，數量至少要為 ${minQty}。`);
      return;
    }

    if (this.isMultiplayer) {
      this.socket.emit('submitBid', { roomCode: this.roomCode, qty, face });
    } else {
      this.handleBid(qty, face, 0);
    }
  }

  handleChallenge() {
    if (this.lastBid === null) return;
    if (this.isMultiplayer) {
      this.socket.emit('challengeLiar', { roomCode: this.roomCode });
    } else {
      this.resolveChallenge(0);
    }
  }

  resolveChallenge(challengerId) {
    this.gameState = 'REVEALED';
    const challenger = this.players[challengerId];
    const bidder = this.players[this.lastBid.bidderId];
    const bidQty = this.lastBid.qty;
    const bidFace = this.lastBid.face;

    // Speak bubble for challenger
    let challengerBubble;
    if (challenger.isAI) {
      challengerBubble = this.getPhrase(challenger.personality, 'liar', bidQty, bidFace);
    } else {
      challengerBubble = `不信你！開！🫵`;
    }
    this.showBubble(challengerId, challengerBubble);

    this.logMsg('system', `🔔 ${challenger.name} 劈了 ${bidder.name} 的喊注 ( ${bidQty} 個 [${bidFace}] )！揭開所有骰盅！`);

    // Lift all cups on table
    this.players.forEach(p => {
      if (!p.isActive || p.isEliminated) return;
      const cup = document.getElementById(`cup-p${p.id}`);
      if (cup) cup.classList.add('lifted');
      
      // Clear dice under cup (dice points under cup are removed)
      const diceDiv = document.getElementById(`dice-p${p.id}`);
      if (diceDiv) diceDiv.innerHTML = '';
    });

    // Count matching dice
    let totalMatching = 0;
    let detailsStr = '';
    const revealContainer = document.getElementById('dice-reveal-container');
    revealContainer.innerHTML = '';

    this.players.forEach(p => {
      if (!p.isActive) return; // Skip inactive players entirely
      let pCount = 0;
      let pDiceHTML = '';
      
      if (!p.isEliminated) {
        p.dice.forEach(val => {
          const isMatch = (val === bidFace) || (this.ruleMode === 'wild' && this.wild1sActive && val === 1);
          if (isMatch) {
            pCount++;
            totalMatching++;
          }
          const extraClass = 'die' + (isMatch ? ' highlight' : '');
          pDiceHTML += this.getDiceHTML(val, p.id !== 0, extraClass);
        });
      } else {
        pDiceHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">已被淘汰</span>`;
      }

      // Add to modal reveal table row
      const row = document.createElement('div');
      row.className = `reveal-row ${p.isAI ? 'ai-p' + p.id : 'player'} ${p.isEliminated ? 'eliminated' : ''}`;
      row.innerHTML = `
        <span class="name">${p.name}</span>
        <div class="dice">${pDiceHTML}</div>
        <span style="font-weight:700;">${p.isEliminated ? '-' : pCount + ' 個'}</span>
      `;
      revealContainer.appendChild(row);
    });

    const isBidSuccessful = totalMatching >= bidQty;
    let loserId;
    let winnerId;

    if (isBidSuccessful) {
      // Bidder wins, challenger loses
      loserId = challengerId;
      winnerId = this.lastBid.bidderId;
    } else {
      // Challenger wins, bidder loses
      loserId = this.lastBid.bidderId;
      winnerId = challengerId;
    }

    const loser = this.players[loserId];
    const winner = this.players[winnerId];

    // Modal popup contents
    const resultTitle = document.getElementById('result-title');
    const resultSummary = document.getElementById('result-summary');
    const resultMath = document.getElementById('result-math-details');

    resultTitle.innerText = isBidSuccessful ? '挑戰失敗！' : '挑戰成功！';
    resultTitle.style.color = isBidSuccessful ? 'var(--accent-rose)' : 'var(--accent-emerald)';

    resultSummary.innerHTML = `
      <span class="player" style="color:${this.getPlayerColor(winnerId)}">${winner.name}</span> 贏得本局！<br>
      <span class="player" style="color:${this.getPlayerColor(loserId)}">${loser.name}</span> 喊注或劈牌失敗！<br>
      全場共有 <span class="qty">${totalMatching}</span> 個 <span class="resolution-summary-die">${this.getDiceHTML(bidFace, false)}</span> (包含 1點變子：${this.ruleMode === 'wild' && this.wild1sActive ? '開' : '關'})。<br>
      上一手喊注為 <span class="qty">${bidQty}</span> 個，實際點數 ${isBidSuccessful ? '足夠' : '不足'}。
    `;

    resultMath.innerHTML = `
      本局不扣除骰子。剩餘骰子：${loser.diceCount} 顆。
    `;

    // Play chimes based on Human outcome
    if (loserId === 0) {
      audio.playLoseChime();
    } else if (winnerId === 0) {
      audio.playWinChime();
    } else {
      audio.playClick();
    }

    // AI reaction speak bubble after challenge
    setTimeout(() => {
      this.showBubble(loserId, this.getPhrase(loser.personality, 'lose'));
      this.showBubble(winnerId, this.getPhrase(winner.personality, 'win'));
    }, 1000);

    // Show result dialog
    setTimeout(() => {
      document.getElementById('result-modal').classList.add('active');
      this.updateLobbyDiceCounts();
    }, 2200);

    this.logMsg('system', `🏁 本局結束：全場共有 ${totalMatching} 個 [${bidFace}]。${winner.name} 勝出，${loser.name} 失去一顆骰子。`);
    
    // Set next starter turn to the loser of this round
    this.currentTurn = loserId;
  }

  prepareNextRound() {
    // Check if game is over (only 1 player remaining with dice among active players)
    const activePlayers = this.players.filter(p => p.isActive && !p.isEliminated);
    if (activePlayers.length <= 1) {
      this.gameState = 'GAMEOVER';
      
      const winner = activePlayers[0] || this.players[0]; // fallback
      
      const chatLog = document.getElementById('game-chat-log');
      chatLog.innerHTML += `<div class="chat-msg system" style="font-size:1.1rem; border:2px solid var(--accent-gold); background:rgba(245, 158, 11, 0.08);">🏆 遊戲結束！恭喜【${winner.name}】成為最終贏家！</div>`;
      
      alert(`🏆 遊戲結束！恭喜【${winner.name}】獲得最終勝利！`);
      
      this.gameState = 'LOBBY';
      this.showScreen('lobby-screen');
    } else {
      this.resetTableState();
    }
  }

  // ==========================================
  // AI LOGIC CORE
  // ==========================================
  runAIDecision(aiPlayer) {
    if (this.gameState !== 'BIDDING') return;

    // Calculate total dice remaining in play
    const activePlayers = this.players.filter(p => p.isActive && !p.isEliminated);
    const totalDiceInPlay = activePlayers.reduce((sum, p) => sum + p.diceCount, 0);
    const myDiceCount = aiPlayer.diceCount;
    const unknownDiceCount = totalDiceInPlay - myDiceCount;

    // Single die success probability
    const singleSuccessProb = (this.ruleMode === 'wild' && this.wild1sActive) ? (2.0 / 6.0) : (1.0 / 6.0);

    // Evaluate last bid if present
    if (this.lastBid !== null) {
      const lastQty = this.lastBid.qty;
      const lastFace = this.lastBid.face;
      
      // Calculate how many matching dice I hold in my own hand
      let myMatches = 0;
      aiPlayer.dice.forEach(val => {
        if (val === lastFace || (this.ruleMode === 'wild' && this.wild1sActive && val === 1)) {
          myMatches++;
        }
      });

      // Additional matches needed from other players
      const needed = Math.max(0, lastQty - myMatches);
      
      // Real mathematical probability that this bid is TRUE based on this AI's hands
      const trueProbability = binomialCumulativeProbability(unknownDiceCount, needed, singleSuccessProb);

      // AI Personality challenge threshold
      let threshold = 0.22; // default tina
      if (aiPlayer.personality === 'sam') threshold = 0.28; // conservative
      if (aiPlayer.personality === 'jack') threshold = 0.08; // aggressive gambler

      // Force challenge if it is physically impossible
      const isImpossible = lastQty > totalDiceInPlay;

      if (trueProbability < threshold || isImpossible) {
        this.resolveChallenge(aiPlayer.id);
        return;
      }
    }

    // If we didn't challenge, we MUST make a higher bid
    // AI scans its own hand to find its strongest face values
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    aiPlayer.dice.forEach(val => counts[val]++);

    // Find the face (excluding 1 if wild) that AI has most of
    let strongestFace = 2;
    let maxCount = -1;
    for (let face = 2; face <= 6; face++) {
      let count = counts[face];
      if (this.ruleMode === 'wild' && this.wild1sActive) {
        count += counts[1]; // include wild 1s
      }
      if (count > maxCount) {
        maxCount = count;
        strongestFace = face;
      }
    }

    // What if AI has lots of 1s (standard wild mode)?
    if (this.ruleMode === 'wild' && this.wild1sActive && counts[1] > maxCount - 1) {
      strongestFace = 1;
      maxCount = counts[1];
    }

    // Estimate total matches of this strongest face in play
    // Expected value = my matches + expected other matches
    const expectedOthers = unknownDiceCount * ((this.ruleMode === 'wild' && this.wild1sActive && strongestFace !== 1) ? (2.0 / 6.0) : (1.0 / 6.0));
    const expectedTotal = maxCount + expectedOthers;

    // Apply personality bluff factor offset
    let bluffOffset = 0;
    if (aiPlayer.personality === 'sam') {
      bluffOffset = Math.random() < 0.2 ? 0.5 : 0; // Sam rarely bluffs
    } else if (aiPlayer.personality === 'tina') {
      bluffOffset = Math.random() < 0.5 ? 0.8 : 0; // Tina occasionally bluffs
    } else if (aiPlayer.personality === 'jack') {
      bluffOffset = Math.floor(Math.random() * 2.5); // Jack frequently bluffs +1 or +2
    }

    let targetQty = Math.round(expectedTotal + bluffOffset);
    // Minimum target qty is 2
    targetQty = Math.max(2, targetQty);

    // Formulate a bid that is higher than the previous
    let finalQty = targetQty;
    let finalFace = strongestFace;

    if (this.lastBid !== null) {
      const prevQty = this.lastBid.qty;
      const prevFace = this.lastBid.face;

      const minQtyForStrongest = this.getMinBidQuantity(strongestFace);

      if (targetQty >= minQtyForStrongest) {
        finalQty = targetQty;
        finalFace = strongestFace;
      } else {
        // Our estimated safe bid is actually lower than the required minimum bid
        // We have to step up. Make the minimum valid raise.
        // Let's decide whether to raise the quantity of the current face, or change face
        if (strongestFace > prevFace) {
          finalQty = prevQty;
          finalFace = strongestFace;
        } else {
          finalQty = prevQty + 1;
          finalFace = strongestFace; // bid on our strong face with +1 quantity
        }
      }
    }

    // Safety check: ensure it is a valid higher bid
    const minQty = this.getMinBidQuantity(finalFace);
    if (finalQty < minQty) {
      finalQty = minQty;
    }

    this.handleBid(finalQty, finalFace, aiPlayer.id);
  }

  // ==========================================
  // HELPERS (UI AND MATH)
  // ==========================================
  updateProbabilityHelper() {
    const p0 = this.players[0];
    if (p0.isEliminated || this.gameState !== 'BIDDING') return;

    const activePlayers = this.players.filter(p => p.isActive && !p.isEliminated);
    const totalDiceInPlay = activePlayers.reduce((sum, p) => sum + p.diceCount, 0);
    const myDiceCount = p0.diceCount;
    const unknownDiceCount = totalDiceInPlay - myDiceCount;

    // Get current preview quantities from slider input
    const input = document.getElementById('bid-qty-input');
    const bidQty = parseInt(input.value);
    const bidFace = this.selectedFace;

    document.getElementById('eval-bid-display').innerHTML = `${bidQty} 個 ${this.getDiceHTML(bidFace, false, 'eval-die')} (點數 ${bidFace})`;

    // Calculate how many of this face Human currently has
    let myMatches = 0;
    p0.dice.forEach(val => {
      if (val === bidFace || (this.ruleMode === 'wild' && this.wild1sActive && val === 1)) {
        myMatches++;
      }
    });

    const needed = Math.max(0, bidQty - myMatches);
    const singleSuccessProb = (this.ruleMode === 'wild' && this.wild1sActive && bidFace !== 1) ? (2.0 / 6.0) : (1.0 / 6.0);

    const prob = binomialCumulativeProbability(unknownDiceCount, needed, singleSuccessProb);
    const percentage = Math.round(prob * 100);

    // Update Circle Ring Offset
    // Dasharray is 251.2
    const offset = 251.2 - (prob * 251.2);
    const fgCircle = document.getElementById('prob-ring');
    fgCircle.style.strokeDashoffset = offset;
    
    // Change color based on safe/danger zone
    if (prob > 0.6) {
      fgCircle.style.stroke = 'var(--accent-emerald)';
    } else if (prob > 0.3) {
      fgCircle.style.stroke = 'var(--accent-gold)';
    } else {
      fgCircle.style.stroke = 'var(--accent-rose)';
    }

    document.getElementById('prob-percentage').innerText = percentage;
    
    // Explanation helper
    document.getElementById('prob-explanation').innerText = `
      你手上有 ${myMatches} 個點數 ${bidFace}。
      在全場其餘 ${unknownDiceCount} 顆未知的骰子中，還需要出現至少 ${needed} 個。
      這項喊注成立的機率為 ${percentage}%。
    `;
  }

  getDiceHTML(face, isBlack = false, extraClasses = '') {
    const themeClass = isBlack ? 'die-black' : 'die-white';
    return `<img src="/dice/${face}.jpg" class="custom-die face-${face} ${themeClass} ${extraClasses}" alt="Dice ${face}" />`;
  }

  getDiceUnicode(face) {
    const faces = {
      1: '⚀',
      2: '⚁',
      3: '⚂',
      4: '⚃',
      5: '⚄',
      6: '⚅'
    };
    return faces[face] || '🎲';
  }

  getPlayerColor(id) {
    const colors = {
      0: '#34d399', // player emerald
      1: '#f472b6', // sam pink
      2: '#38bdf8', // tina sky-blue
      3: '#fbbf24'  // jack yellow/gold
    };
    return colors[id] || '#fff';
  }

  showBubble(playerId, text) {
    const bubble = document.getElementById(`speech-p${playerId}`);
    if (!bubble) return;
    
    bubble.innerText = text;
    bubble.classList.add('active');
    
    // clear bubble after 3 seconds
    if (bubble.timeoutId) clearTimeout(bubble.timeoutId);
    bubble.timeoutId = setTimeout(() => {
      bubble.classList.remove('active');
    }, 3000);
  }

  getPhrase(personality, state, arg1, arg2) {
    const char = AI_PHRASES[personality];
    if (!char) return '...';
    
    const phrases = char[state];
    if (!phrases || phrases.length === 0) return '...';

    const index = Math.floor(Math.random() * phrases.length);
    const phrase = phrases[index];

    if (typeof phrase === 'function') {
      return phrase(arg1, arg2);
    }
    return phrase;
  }

  logMsg(type, senderOrId, text) {
    const chatLog = document.getElementById('game-chat-log');
    const msg = document.createElement('div');
    
    if (type === 'system') {
      msg.className = 'chat-msg system';
      msg.innerHTML = senderOrId;
    } else if (type === 'action') {
      const id = senderOrId;
      const player = this.players[id];
      msg.className = `chat-msg action ai-p${id}`;
      if (id === 0) msg.className = 'chat-msg action player';
      
      msg.innerHTML = `<span class="sender">${player.name}:</span> ${text}`;
    }

    chatLog.appendChild(msg);
    // Scroll to bottom
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const game = new LiarDiceGame();
  game.initUI();
});
