import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Enable CORS for frontend development server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3000;

// Active rooms database
const rooms = {};

// Helper: Generate a unique 4-character room code
function generateRoomCode() {
  const chars = '0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// Helper: Generate dice faces (auto re-rolls straights)
function rollDice(count) {
  if (count <= 0) return [];
  let dice = [];
  let isStraight = false;
  do {
    dice = [];
    for (let i = 0; i < count; i++) {
      dice.push(Math.floor(Math.random() * 6) + 1);
    }
    dice.sort((a, b) => a - b);
    
    // Straight check (no pairs / all values unique)
    if (count > 1 && new Set(dice).size === dice.length) {
      isStraight = true;
    } else {
      isStraight = false;
    }
  } while (isStraight);
  return dice;
}

// Helper: get first free ID from 0 to 3
function getFreePlayerId(room) {
  const ids = room.players.map(p => p.id);
  for (let i = 0; i < 4; i++) {
    if (!ids.includes(i)) return i;
  }
  return -1;
}

// Helper: Serialize room data for a specific client (F12 cheat prevention)
function serializeRoomForPlayer(room, socketId) {
  const playersCopy = room.players.map(p => {
    const isSelf = p.socketId === socketId;
    const revealAll = room.gameState === 'REVEALED';
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      diceCount: p.diceCount,
      isAI: p.isAI,
      personality: p.personality,
      isEliminated: p.isEliminated,
      socketId: p.socketId,
      // Only send dice array to the player themselves OR if the round is revealed
      dice: (isSelf || revealAll) ? p.dice : []
    };
  });
  return {
    id: room.id,
    owner: room.owner,
    ruleMode: room.ruleMode,
    initialDiceCount: room.initialDiceCount,
    gameState: room.gameState,
    players: playersCopy,
    currentTurnIndex: room.currentTurnIndex,
    lastBid: room.lastBid,
    wild1sActive: room.wild1sActive,
    winnerName: room.winnerName
  };
}

// Helper: Broadcast room status to all clients inside a room (separately for each player)
function broadcastRoomUpdate(room) {
  room.players.forEach(p => {
    if (p.isAI) return;
    io.to(p.socketId).emit('roomUpdated', serializeRoomForPlayer(room, p.socketId));
  });
}

// Helper: Get minimum bid quantity needed
function getMinBidQuantity(lastBid, face) {
  if (lastBid === null) return 2;
  const prevQty = lastBid.qty;
  const prevFace = lastBid.face;
  if (face > prevFace) {
    return prevQty;
  } else {
    return prevQty + 1;
  }
}

// Math helpers for AI binomial distribution calculations
function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = res * (n - r + i) / i;
  }
  return Math.round(res);
}

function binomialCumulativeProbability(n, k_needed, p) {
  if (k_needed <= 0) return 1.0;
  if (k_needed > n) return 0.0;
  let prob = 0.0;
  for (let i = k_needed; i <= n; i++) {
    prob += nCr(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  return prob;
}

// AI decision execution logic on the server
function runAIDecision(room) {
  if (room.gameState !== 'BIDDING') return;

  const aiPlayer = room.players[room.currentTurnIndex];
  if (!aiPlayer || !aiPlayer.isAI) return;

  const activePlayers = room.players.filter(p => !p.isEliminated);
  const totalDiceInPlay = activePlayers.reduce((sum, p) => sum + p.diceCount, 0);
  const myDiceCount = aiPlayer.diceCount;
  const unknownDiceCount = totalDiceInPlay - myDiceCount;

  // Single die success probability
  const singleSuccessProb = (room.ruleMode === 'wild' && room.wild1sActive) ? (2.0 / 6.0) : (1.0 / 6.0);

  // Evaluate last bid
  if (room.lastBid !== null) {
    const lastQty = room.lastBid.qty;
    const lastFace = room.lastBid.face;

    let myMatches = 0;
    aiPlayer.dice.forEach(val => {
      if (val === lastFace || (room.ruleMode === 'wild' && room.wild1sActive && val === 1)) {
        myMatches++;
      }
    });

    const needed = Math.max(0, lastQty - myMatches);
    const trueProbability = binomialCumulativeProbability(unknownDiceCount, needed, singleSuccessProb);

    let threshold = 0.22; // default tina
    if (aiPlayer.personality === 'sam') threshold = 0.28;
    if (aiPlayer.personality === 'jack') threshold = 0.08;

    const isImpossible = lastQty > totalDiceInPlay;

    if (trueProbability < threshold || isImpossible) {
      setTimeout(() => {
        resolveChallenge(room, aiPlayer.id);
      }, 1500);
      return;
    }
  }

  // Choose bid
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  aiPlayer.dice.forEach(val => counts[val]++);

  let strongestFace = 2;
  let maxCount = -1;
  for (let face = 2; face <= 6; face++) {
    let count = counts[face];
    if (room.ruleMode === 'wild' && room.wild1sActive) {
      count += counts[1];
    }
    if (count > maxCount) {
      maxCount = count;
      strongestFace = face;
    }
  }

  if (room.ruleMode === 'wild' && room.wild1sActive && counts[1] > maxCount - 1) {
    strongestFace = 1;
    maxCount = counts[1];
  }

  const expectedOthers = unknownDiceCount * ((room.ruleMode === 'wild' && room.wild1sActive && strongestFace !== 1) ? (2.0 / 6.0) : (1.0 / 6.0));
  const expectedTotal = maxCount + expectedOthers;

  let bluffOffset = 0;
  if (aiPlayer.personality === 'sam') {
    bluffOffset = Math.random() < 0.2 ? 0.5 : 0;
  } else if (aiPlayer.personality === 'tina') {
    bluffOffset = Math.random() < 0.5 ? 0.8 : 0;
  } else if (aiPlayer.personality === 'jack') {
    bluffOffset = Math.floor(Math.random() * 2.5);
  }

  let targetQty = Math.round(expectedTotal + bluffOffset);
  targetQty = Math.max(2, targetQty);

  let finalQty = targetQty;
  let finalFace = strongestFace;

  if (room.lastBid !== null) {
    const prevQty = room.lastBid.qty;
    const prevFace = room.lastBid.face;
    const minQtyForStrongest = getMinBidQuantity(room.lastBid, strongestFace);

    if (targetQty >= minQtyForStrongest) {
      finalQty = targetQty;
      finalFace = strongestFace;
    } else {
      if (strongestFace > prevFace) {
        finalQty = prevQty;
        finalFace = strongestFace;
      } else {
        finalQty = prevQty + 1;
        finalFace = strongestFace;
      }
    }
  }

  const minQty = getMinBidQuantity(room.lastBid, finalFace);
  if (finalQty < minQty) {
    finalQty = minQty;
  }

  setTimeout(() => {
    handleBid(room, finalQty, finalFace, aiPlayer.id);
  }, 1500);
}

// Perform bid sequence
function handleBid(room, qty, face, bidderId) {
  const bidder = room.players.find(p => p.id === bidderId);
  if (!bidder) return;

  if (room.ruleMode === 'wild' && face === 1 && room.wild1sActive) {
    room.wild1sActive = false;
  }

  room.lastBid = { qty, face, bidderId };
  
  // Advance turn to next active, non-eliminated player
  let loopCount = 0;
  do {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    loopCount++;
  } while (room.players[room.currentTurnIndex].isEliminated && loopCount < 10);

  // Broadcast bid
  io.to(room.id).emit('bidUpdated', {
    lastBid: room.lastBid,
    currentTurnIndex: room.currentTurnIndex,
    wild1sActive: room.wild1sActive
  });

  // Re-broadcast general room update
  broadcastRoomUpdate(room);

  // If next player is AI, run its decision
  const nextPlayer = room.players[room.currentTurnIndex];
  if (nextPlayer && nextPlayer.isAI && !nextPlayer.isEliminated) {
    setTimeout(() => {
      runAIDecision(room);
    }, 1000 + Math.random() * 1000);
  }
}

// Perform challenge resolution
function resolveChallenge(room, challengerId) {
  room.gameState = 'REVEALED';
  const challenger = room.players.find(p => p.id === challengerId);
  const bidder = room.players.find(p => p.id === room.lastBid.bidderId);
  const bidQty = room.lastBid.qty;
  const bidFace = room.lastBid.face;

  let totalMatching = 0;
  room.players.forEach(p => {
    if (p.isEliminated) return;
    p.dice.forEach(val => {
      const isMatch = (val === bidFace) || (room.ruleMode === 'wild' && room.wild1sActive && val === 1);
      if (isMatch) totalMatching++;
    });
  });

  const isBidSuccessful = totalMatching >= bidQty;
  let loser, winner;

  if (isBidSuccessful) {
    loser = challenger;
    winner = bidder;
  } else {
    loser = bidder;
    winner = challenger;
  }

  let isLoserEliminated = false;

  // Set the starter turn of next round to the loser
  let nextTurnIndex = room.players.findIndex(p => p.id === loser.id);
  room.currentTurnIndex = nextTurnIndex;

  // Emit event to trigger circular table cup lift and play chimes
  io.to(room.id).emit('challengeResolved', {
    challengerId,
    bidderId: bidder.id,
    bidQty,
    bidFace,
    totalMatching,
    isBidSuccessful,
    winnerId: winner.id,
    loserId: loser.id,
    isLoserEliminated,
    nextTurnIndex: room.currentTurnIndex
  });

  // Re-broadcast updated scores/dice arrays (now including everyone's dice arrays)
  broadcastRoomUpdate(room);
}

// Socket communication routing
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (Total clients: ${io.engine.clientsCount})`);

  // 1. Create Room
  socket.on('createRoom', ({ playerName }) => {
    const code = generateRoomCode();
    const avatar = '⚡'; // Default avatar for player 0
    const newPlayer = {
      socketId: socket.id,
      id: 0, // Host is always 0
      name: playerName || '玩家1',
      avatar,
      diceCount: 5,
      dice: [],
      isAI: false,
      isEliminated: false,
      personality: 'human'
    };

    rooms[code] = {
      id: code,
      owner: socket.id,
      ruleMode: 'wild',
      initialDiceCount: 5,
      gameState: 'LOBBY',
      players: [newPlayer],
      currentTurnIndex: 0,
      lastBid: null,
      wild1sActive: true,
      winnerName: null
    };

    socket.join(code);
    console.log(`🏠 Room created: ${code} by ${playerName}`);
    
    socket.emit('roomCreated', { roomCode: code, player: newPlayer });
    broadcastRoomUpdate(rooms[code]);
  });

  // 2. Join Room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('joinError', '找不到該房間，請檢查房號是否輸入正確。');
      return;
    }
    if (room.gameState !== 'LOBBY') {
      socket.emit('joinError', '該房間遊戲已經開始，無法加入。');
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('joinError', '房間已滿（最多 4 人）。');
      return;
    }

    const freeId = getFreePlayerId(room);
    const avatars = ['⚡', '🧔', '👩‍🎤', '🤠'];
    const avatar = avatars[freeId] || '🦊';
    
    const newPlayer = {
      socketId: socket.id,
      id: freeId,
      name: playerName || `玩家${freeId + 1}`,
      avatar,
      diceCount: room.initialDiceCount,
      dice: [],
      isAI: false,
      isEliminated: false,
      personality: 'human'
    };

    room.players.push(newPlayer);
    socket.join(roomCode);
    console.log(`👥 Player ${playerName} joined Room ${roomCode}`);

    socket.emit('roomJoined', { roomCode, player: newPlayer });
    broadcastRoomUpdate(room);
  });

  // 3. Add AI filled slots
  socket.on('addAI', ({ roomCode, personality }) => {
    const room = rooms[roomCode];
    if (!room || room.owner !== socket.id) return;
    if (room.players.length >= 4) return;

    const freeId = getFreePlayerId(room);
    
    let name = '巴曼山姆';
    let avatar = '🧔';
    if (personality === 'tina') {
      name = '榮耀蒂娜';
      avatar = '👩‍🎤';
    } else if (personality === 'jack') {
      name = '賭徒傑克';
      avatar = '🤠';
    }

    const newAI = {
      socketId: null,
      id: freeId,
      name,
      avatar,
      diceCount: room.initialDiceCount,
      dice: [],
      isAI: true,
      isEliminated: false,
      personality
    };

    room.players.push(newAI);
    console.log(`🤖 AI ${name} added to Room ${roomCode}`);
    broadcastRoomUpdate(room);
  });

  // 4. Kick Player or AI
  socket.on('kickPlayer', ({ roomCode, playerId }) => {
    const room = rooms[roomCode];
    if (!room || room.owner !== socket.id) return;

    const targetIdx = room.players.findIndex(p => p.id === playerId);
    if (targetIdx !== -1) {
      const target = room.players[targetIdx];
      
      // Remove from socket room if it's a real player
      if (!target.isAI && target.socketId) {
        const clientSocket = io.sockets.sockets.get(target.socketId);
        if (clientSocket) {
          clientSocket.leave(roomCode);
          clientSocket.emit('kicked');
        }
      }

      room.players.splice(targetIdx, 1);
      console.log(`👢 Player/AI (ID: ${playerId}) kicked from Room ${roomCode}`);
      broadcastRoomUpdate(room);
    }
  });

  // 5. Update Room Settings
  socket.on('updateSettings', ({ roomCode, ruleMode, initialDiceCount }) => {
    const room = rooms[roomCode];
    if (!room || room.owner !== socket.id) return;

    room.ruleMode = ruleMode;
    room.initialDiceCount = initialDiceCount;

    // Apply initial dice count to existing lobby players
    room.players.forEach(p => {
      p.diceCount = initialDiceCount;
    });

    broadcastRoomUpdate(room);
  });

  // 6. Start Sync Game
  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.owner !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('gameError', '至少需要 2 人才能開始遊戲！');
      return;
    }

    room.gameState = 'ROLLING';
    room.lastBid = null;
    room.wild1sActive = room.ruleMode === 'wild';
    room.currentTurnIndex = 0;

    // Roll for everyone (auto-rolls straights)
    room.players.forEach(p => {
      p.isEliminated = false;
      p.diceCount = room.initialDiceCount;
      p.dice = rollDice(p.diceCount);
    });

    io.to(roomCode).emit('gameStarted');
    broadcastRoomUpdate(room);

    // Timeout to finish visual cup rolling animation (1200ms)
    setTimeout(() => {
      room.gameState = 'BIDDING';
      io.to(roomCode).emit('biddingRoundStarted');
      broadcastRoomUpdate(room);

      // Check if first turn belongs to an AI player
      const firstPlayer = room.players[room.currentTurnIndex];
      if (firstPlayer && firstPlayer.isAI) {
        runAIDecision(room);
      }
    }, 1200);
  });

  // 7. Human Bidding Action
  socket.on('submitBid', ({ roomCode, qty, face }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'BIDDING') return;

    // Verify turn order
    const activePlayer = room.players[room.currentTurnIndex];
    if (activePlayer.socketId !== socket.id) {
      socket.emit('gameError', '還沒輪到你喊注！');
      return;
    }

    // Validate bid values
    const minQty = getMinBidQuantity(room.lastBid, face);
    if (qty < minQty) {
      socket.emit('gameError', '喊注無效！數量或點數不足。');
      return;
    }

    handleBid(room, qty, face, activePlayer.id);
  });

  // 8. Human Liar Call Action
  socket.on('challengeLiar', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'BIDDING' || room.lastBid === null) return;

    // Verify turn order
    const activePlayer = room.players[room.currentTurnIndex];
    if (activePlayer.socketId !== socket.id) {
      socket.emit('gameError', '還沒輪到你叫牌！');
      return;
    }

    resolveChallenge(room, activePlayer.id);
  });

  // 9. Play Next Round
  socket.on('nextRound', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.owner !== socket.id) return;

    // Verify if game is over
    const survivors = room.players.filter(p => !p.isEliminated);
    if (survivors.length <= 1) {
      room.gameState = 'LOBBY';
      room.winnerName = survivors[0] ? survivors[0].name : room.players[0].name;
      io.to(roomCode).emit('gameFinished', { winnerName: room.winnerName });
      
      // Reset rooms settings
      room.players.forEach(p => {
        p.diceCount = room.initialDiceCount;
        p.dice = [];
        p.isEliminated = false;
      });
      broadcastRoomUpdate(room);
      return;
    }

    // Otherwise roll and start next round
    room.gameState = 'ROLLING';
    room.lastBid = null;
    room.wild1sActive = room.ruleMode === 'wild';

    room.players.forEach(p => {
      if (p.isEliminated) return;
      p.dice = rollDice(p.diceCount);
    });

    io.to(roomCode).emit('gameStarted');
    broadcastRoomUpdate(room);

    setTimeout(() => {
      room.gameState = 'BIDDING';
      io.to(roomCode).emit('biddingRoundStarted');
      broadcastRoomUpdate(room);

      const activePlayer = room.players[room.currentTurnIndex];
      if (activePlayer && activePlayer.isAI && !activePlayer.isEliminated) {
        runAIDecision(room);
      }
    }, 1200);
  });

  // 10. Disconnect Handler
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    
    // Find rooms containing the client
    for (const code in rooms) {
      const room = rooms[code];
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      
      if (idx !== -1) {
        const p = room.players[idx];
        console.log(`🚪 Player ${p.name} disconnected from Room ${code}`);
        
        if (room.gameState === 'LOBBY') {
          // In lobby, just drop the player
          room.players.splice(idx, 1);
          
          if (room.players.length === 0) {
            // Room empty, delete room
            delete rooms[code];
            console.log(`🗑️ Room ${code} empty, deleted.`);
          } else {
            // Re-delegate owner if owner disconnected
            if (room.owner === socket.id) {
              const newOwner = room.players.find(p => !p.isAI);
              if (newOwner) {
                room.owner = newOwner.socketId;
                console.log(`👑 Room ${code} ownership transferred to ${newOwner.name}`);
              } else {
                // Only AI remaining, delete
                delete rooms[code];
                console.log(`🗑️ Room ${code} has only AIs remaining, deleted.`);
                continue;
              }
            }
            broadcastRoomUpdate(room);
          }
        } else {
          // Game already running, mark the disconnected player as eliminated (or we could convert to AI, but marking as eliminated is standard for drops)
          p.isEliminated = true;
          p.diceCount = 0;
          p.socketId = null;
          
          // Tally active human players remaining
          const humanSurvivors = room.players.filter(p => !p.isAI && !p.isEliminated);
          if (humanSurvivors.length === 0) {
            // No humans left, close room
            delete rooms[code];
            console.log(`🗑️ Room ${code} has no active humans remaining, deleted.`);
          } else {
            // If the disconnected player was the room owner, re-delegate owner
            if (room.owner === socket.id) {
              const newOwner = humanSurvivors[0];
              room.owner = newOwner.socketId;
              console.log(`👑 Room ${code} ownership transferred to ${newOwner.name}`);
            }
            
            // Advance turn if it was their turn
            if (room.currentTurnIndex === idx) {
              let loopCount = 0;
              do {
                room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
                loopCount++;
              } while (room.players[room.currentTurnIndex].isEliminated && loopCount < 10);
            }
            
            broadcastRoomUpdate(room);
          }
        }
      }
    }
  });
});

// Start listening
httpServer.listen(PORT, () => {
  console.log(`🚀 Liar's Dice Server listening on port ${PORT}`);
});
