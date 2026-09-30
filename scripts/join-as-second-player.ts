/**
 * Simulated second player for multiplayer testing.
 * Connects, joins the specified room, and acts as a passive observer:
 * - If a game round starts, it picks anime A immediately.
 * - On reveal, prints the scores.
 * - On game end, exits.
 */
import { io } from 'socket.io-client'

const ROOM_ID = process.argv[2] || '3V777M'
const NAME = process.argv[3] || '玩家B'

const socket = io('http://localhost:81/?XTransformPort=3003', {
  transports: ['websocket', 'polling'],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 3,
})

socket.on('connect', () => {
  console.log(`[${NAME}] connected as ${socket.id}, joining ${ROOM_ID}`)
  socket.emit('room:join', { roomId: ROOM_ID, username: NAME })
})

socket.on('room:joined', (data) => {
  console.log(`[${NAME}] joined room ${data.roomId}`)
})

socket.on('room:state', (state) => {
  if (state.phase === 'playing' && state.pair) {
    const [a, b] = state.pair
    console.log(
      `[${NAME}] round ${state.round}: ${a.name_cn}(${a.score}) vs ${b.name_cn}(${b.score})`,
    )
    // Pick anime A immediately to test the round flow
    if (!state.picks[socket.id]?.picked) {
      console.log(`[${NAME}] picking ${a.name_cn} (id=${a.id})`)
      socket.emit('game:pick', { animeId: a.id })
    }
  } else if (state.phase === 'reveal') {
    console.log(`[${NAME}] reveal — scores: ${JSON.stringify(state.scores)}`)
  } else if (state.phase === 'finished') {
    console.log(
      `[${NAME}] game finished — scores: ${JSON.stringify(state.scores)}`,
    )
    socket.disconnect()
    process.exit(0)
  }
})

socket.on('room:error', (data) => {
  console.log(`[${NAME}] room error: ${data.message}`)
})

socket.on('disconnect', () => {
  console.log(`[${NAME}] disconnected`)
})

// Keep alive for 5 minutes max
setTimeout(() => {
  console.log(`[${NAME}] 5min timeout, exiting`)
  socket.disconnect()
  process.exit(0)
}, 300000)
