import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it for routing.
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---- Types ---------------------------------------------------------------

interface Player {
  id: string
  username: string
  isHost: boolean
  connected: boolean
}

interface PickInfo {
  animeId: number
  timestamp: number
}

interface Room {
  id: string
  players: Map<string, Player>
  pair: AnimeItem[] | null
  /** True if pair[0] was carried over from the previous round's B (chain mode). */
  aIsCarryOver: boolean
  /** All anime ids shown in this game so far — used to dedupe picks. */
  seenIds: number[]
  picks: Map<string, PickInfo>
  round: number
  totalRounds: number
  scores: Record<string, number>
  phase: 'waiting' | 'playing' | 'reveal' | 'finished'
  startedAt: number | null
  revealTimer: ReturnType<typeof setTimeout> | null
  roundEndTimer: ReturnType<typeof setTimeout> | null
  filters: ClientFilters
}

interface AnimeItem {
  id: number
  name: string
  name_cn: string
  date: string
  score: number
  rating_count: number
  rank: number
  cover: string
  summary: string
}

interface ClientFilters {
  yearStart?: number
  yearEnd?: number
  minRatingCount?: number
  minScore?: number
  maxScore?: number
}

// ---- State ----------------------------------------------------------------

const rooms = new Map<string, Room>()

function generateRoomId(): string {
  // 6-char uppercase alphanumeric, exclude ambiguous chars (0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return rooms.has(id) ? generateRoomId() : id
}

function getOtherPlayerId(room: Room, playerId: string): string | null {
  for (const pid of room.players.keys()) {
    if (pid !== playerId) return pid
  }
  return null
}

function publicPlayer(p: Player) {
  return { id: p.id, username: p.username, isHost: p.isHost }
}

function publicRoomState(room: Room) {
  return {
    roomId: room.id,
    round: room.round,
    totalRounds: room.totalRounds,
    phase: room.phase,
    scores: room.scores,
    players: Array.from(room.players.values()).map(publicPlayer),
    pair: room.pair,
    aIsCarryOver: room.aIsCarryOver,
    picks: Object.fromEntries(
      Array.from(room.picks.entries()).map(([pid, p]) => [
        pid,
        { animeId: p.animeId, picked: true },
      ]),
    ),
  }
}

function clearTimers(room: Room) {
  if (room.revealTimer) {
    clearTimeout(room.revealTimer)
    room.revealTimer = null
  }
  if (room.roundEndTimer) {
    clearTimeout(room.roundEndTimer)
    room.roundEndTimer = null
  }
}

function emitRoomState(room: Room) {
  io.to(`room:${room.id}`).emit('room:state', publicRoomState(room))
}

// ---- Fetch pair / single from main Next.js API ---------------------------

async function fetchPair(
  filters: ClientFilters,
  excludeIds: number[] = [],
): Promise<AnimeItem[]> {
  // The Next.js dev server runs on port 3000 internally.
  const url = `http://localhost:3000/api/bangumi`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...filters, count: 2, excludeIds }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const data = (await res.json()) as { pair: AnimeItem[]; poolSize: number }
  if (!data.pair || data.pair.length !== 2) {
    throw new Error('无法抽取番剧对，请放宽筛选条件')
  }
  return data.pair
}

/**
 * Fetch a single anime, optionally excluding previously-seen ids (used by
 * chain mode so the new B is different from anything already shown this game).
 */
async function fetchSingle(
  filters: ClientFilters,
  excludeIds: number[] = [],
): Promise<AnimeItem> {
  const url = `http://localhost:3000/api/bangumi`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...filters, count: 1, excludeIds }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const data = (await res.json()) as { anime: AnimeItem; poolSize: number }
  if (!data.anime) {
    throw new Error('无法抽取新番剧，请放宽筛选条件')
  }
  return data.anime
}

// ---- Game logic -----------------------------------------------------------

function computeCorrectId(room: Room): number | null {
  if (!room.pair || room.pair.length !== 2) return null
  const [a, b] = room.pair
  if (a.score > b.score) return a.id
  if (b.score > a.score) return b.id
  return null // tie
}

function applyPicks(room: Room) {
  if (room.phase !== 'playing') return
  const correctId = computeCorrectId(room)
  if (correctId === null) return

  const playerIds = Array.from(room.players.keys())
  const allPicked = playerIds.every((pid) => room.picks.has(pid))
  if (!allPicked) return

  // Reveal
  room.phase = 'reveal'
  room.startedAt = null
  clearTimers(room)

  // Compute scores
  const pickTimes: { pid: string; time: number }[] = []
  for (const [pid, p] of room.picks.entries()) {
    pickTimes.push({ pid, time: p.timestamp })
  }
  pickTimes.sort((a, b) => a.time - b.time)

  let firstCorrectPid: string | null = null
  const updates: Record<string, { delta: number; correct: boolean }> = {}

  for (const { pid, time } of pickTimes) {
    const pick = room.picks.get(pid)!
    const correct = pick.animeId === correctId
    let delta = 0
    if (correct) {
      delta = 10
      if (!firstCorrectPid) {
        // First correct gets +5 speed bonus
        delta += 5
        firstCorrectPid = pid
      }
    } else {
      delta = -3
    }
    room.scores[pid] = Math.max(0, (room.scores[pid] ?? 0) + delta)
    updates[pid] = { delta, correct }
  }

  io.to(`room:${room.id}`).emit('game:round_end', {
    correctId,
    updates,
    scores: room.scores,
    round: room.round,
  })
  emitRoomState(room)
}

// ---- Socket handlers ------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[ws] connected: ${socket.id}`)

  socket.on('room:create', (data: { username: string }) => {
    const username = (data?.username ?? '').toString().trim().slice(0, 20)
    if (!username) {
      socket.emit('room:error', { message: '请输入昵称' })
      return
    }
    const roomId = generateRoomId()
    const room: Room = {
      id: roomId,
      players: new Map(),
      pair: null,
      aIsCarryOver: false,
      seenIds: [],
      picks: new Map(),
      round: 0,
      totalRounds: 10,
      scores: {},
      phase: 'waiting',
      startedAt: null,
      revealTimer: null,
      roundEndTimer: null,
      filters: {},
    }
    const player: Player = {
      id: socket.id,
      username,
      isHost: true,
      connected: true,
    }
    room.players.set(socket.id, player)
    room.scores[socket.id] = 0
    rooms.set(roomId, room)
    socket.join(`room:${roomId}`)

    socket.emit('room:created', { roomId, player: publicPlayer(player) })
    emitRoomState(room)
    console.log(`[ws] room created: ${roomId} by ${username}`)
  })

  socket.on('room:join', (data: { roomId: string; username: string }) => {
    const roomId = (data?.roomId ?? '').toString().toUpperCase().trim()
    const username = (data?.username ?? '').toString().trim().slice(0, 20)
    if (!username) {
      socket.emit('room:error', { message: '请输入昵称' })
      return
    }
    if (!roomId) {
      socket.emit('room:error', { message: '请输入房间号' })
      return
    }
    const room = rooms.get(roomId)
    if (!room) {
      socket.emit('room:error', { message: '房间不存在' })
      return
    }
    if (room.players.size >= 2) {
      socket.emit('room:error', { message: '房间已满' })
      return
    }
    if (room.phase !== 'waiting') {
      socket.emit('room:error', { message: '游戏已经开始' })
      return
    }

    const player: Player = {
      id: socket.id,
      username,
      isHost: false,
      connected: true,
    }
    room.players.set(socket.id, player)
    room.scores[socket.id] = 0
    socket.join(`room:${roomId}`)

    socket.emit('room:joined', {
      roomId,
      player: publicPlayer(player),
    })
    emitRoomState(room)
    console.log(`[ws] ${username} joined room ${roomId}`)
  })

  socket.on('game:start', (data: { filters?: ClientFilters }) => {
    const room = findRoomBySocket(socket)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player?.isHost) {
      socket.emit('room:error', { message: '只有房主可以开始游戏' })
      return
    }
    if (room.players.size < 2) {
      socket.emit('room:error', { message: '需要 2 名玩家才能开始' })
      return
    }
    if (room.phase !== 'waiting' && room.phase !== 'finished') {
      socket.emit('room:error', { message: '当前无法开始游戏' })
      return
    }

    // Reset scores & round
    room.round = 0
    for (const pid of room.players.keys()) {
      room.scores[pid] = 0
    }
    room.picks.clear()
    room.pair = null
    room.aIsCarryOver = false
    room.seenIds = []
    room.phase = 'playing'
    room.filters = data?.filters ?? {}
    clearTimers(room)

    startNextRound(room).catch((err) => {
      io.to(`room:${room.id}`).emit('room:error', {
        message: err.message || '启动游戏失败',
      })
      room.phase = 'waiting'
      emitRoomState(room)
    })
  })

  socket.on('game:pick', (data: { animeId: number }) => {
    const room = findRoomBySocket(socket)
    if (!room) return
    if (room.phase !== 'playing') return
    if (room.picks.has(socket.id)) return // already picked

    const animeId = Number(data?.animeId)
    if (!Number.isFinite(animeId)) return

    room.picks.set(socket.id, { animeId, timestamp: Date.now() })

    // Broadcast updated room state so all clients can show "X picked"
    io.to(`room:${room.id}`).emit('game:pick', {
      playerId: socket.id,
      animeId,
    })
    emitRoomState(room)

    // Check if all picked → reveal
    applyPicks(room)
  })

  socket.on('game:next', () => {
    const room = findRoomBySocket(socket)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player?.isHost) {
      socket.emit('room:error', { message: '只有房主可以进入下一题' })
      return
    }
    if (room.phase !== 'reveal') return
    startNextRound(room).catch((err) => {
      io.to(`room:${room.id}`).emit('room:error', {
        message: err.message || '加载下一题失败',
      })
    })
  })

  socket.on('room:leave', () => {
    handleDisconnect(socket)
    socket.leaveAll()
  })

  socket.on('disconnect', () => {
    handleDisconnect(socket)
  })

  socket.on('error', (err) => {
    console.error(`[ws] socket error (${socket.id}):`, err)
  })
})

function findRoomBySocket(socket: { id: string }): Room | null {
  for (const room of rooms.values()) {
    if (room.players.has(socket.id)) return room
  }
  return null
}

function handleDisconnect(socket: { id: string }) {
  for (const [roomId, room] of rooms.entries()) {
    const player = room.players.get(socket.id)
    if (!player) continue
    room.players.delete(socket.id)
    delete room.scores[socket.id]
    room.picks.delete(socket.id)
    clearTimers(room)

    if (room.players.size === 0) {
      rooms.delete(roomId)
      console.log(`[ws] room ${roomId} removed (empty)`)
      return
    }

    // Promote new host if needed
    const remaining = Array.from(room.players.values())
    if (!remaining.some((p) => p.isHost) && remaining.length > 0) {
      remaining[0].isHost = true
    }

    io.to(`room:${roomId}`).emit('room:player_left', { playerId: socket.id })
    if (room.phase === 'playing' || room.phase === 'reveal') {
      // Abort current round and reset seen ids (next game starts fresh).
      room.phase = 'waiting'
      room.pair = null
      room.aIsCarryOver = false
      room.seenIds = []
      room.picks.clear()
      io.to(`room:${roomId}`).emit('room:error', {
        message: '对手已离开，等待新玩家加入',
      })
    }
    emitRoomState(room)
  }
}

async function startNextRound(room: Room) {
  if (room.round >= room.totalRounds) {
    room.phase = 'finished'
    const entries = Object.entries(room.scores)
    let winnerId: string | null = null
    if (entries.length === 2) {
      const [a, b] = entries
      if (a[1] > b[1]) winnerId = a[0]
      else if (b[1] > a[1]) winnerId = b[0]
      else winnerId = null // tie
    }
    io.to(`room:${room.id}`).emit('game:end', {
      winnerId,
      finalScores: room.scores,
    })
    emitRoomState(room)
    return
  }

  // Chain mode:
  // - Round 1 (or no previous pair): fetch a fresh pair [A, B]
  // - Round N>1: carry previous B → new A, fetch a single fresh anime → new B
  const isFirstRound = room.round === 0 || !room.pair
  const previousB = !isFirstRound && room.pair ? room.pair[1] : null

  room.round += 1
  room.picks.clear()
  room.pair = null
  room.phase = 'playing'
  room.startedAt = null
  clearTimers(room)

  // Emit loading state
  io.to(`room:${room.id}`).emit('game:loading', { round: room.round })
  emitRoomState(room)

  let pair: AnimeItem[]
  if (isFirstRound) {
    pair = await fetchPair(room.filters, room.seenIds)
    room.aIsCarryOver = false
    // Track newly seen ids.
    for (const item of pair) {
      if (!room.seenIds.includes(item.id)) {
        room.seenIds.push(item.id)
      }
    }
  } else {
    // Fetch a single new anime for B; carry previous B to A.
    // Pass all seen ids (which includes the carried A) as exclusions.
    const newB = await fetchSingle(room.filters, room.seenIds)
    pair = [previousB!, newB]
    room.aIsCarryOver = true
    if (!room.seenIds.includes(newB.id)) {
      room.seenIds.push(newB.id)
    }
  }
  room.pair = pair
  room.startedAt = Date.now()

  io.to(`room:${room.id}`).emit('game:round', {
    round: room.round,
    totalRounds: room.totalRounds,
    pair,
    aIsCarryOver: room.aIsCarryOver,
    startedAt: room.startedAt,
  })
  emitRoomState(room)

  // Auto-reveal after 20 seconds if not all picked.
  room.roundEndTimer = setTimeout(() => {
    if (room.phase === 'playing') {
      // Force-reveal with whatever picks exist
      applyPicks(room)
      // If no picks were made, still broadcast a reveal
      if (room.phase !== 'reveal') {
        room.phase = 'reveal'
        const correctId = computeCorrectId(room)
        io.to(`room:${room.id}`).emit('game:round_end', {
          correctId,
          updates: {},
          scores: room.scores,
          round: room.round,
        })
        emitRoomState(room)
      }
    }
  }, 20000)
}

// ---- Boot -----------------------------------------------------------------

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[multiplayer] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[multiplayer] received SIGTERM, shutting down')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[multiplayer] received SIGINT, shutting down')
  httpServer.close(() => process.exit(0))
})
