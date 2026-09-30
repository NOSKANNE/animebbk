import { io } from 'socket.io-client'

// Connect via the gateway (port 81)
const socket = io('http://localhost:81/?XTransformPort=3003', {
  transports: ['websocket', 'polling'],
  forceNew: true,
  reconnection: false,
})

socket.on('connect', () => {
  console.log('[P2] connected as', socket.id)
  // Join the room created by P1
  socket.emit('room:join', { roomId: '3V777M', username: '玩家B' })
})

socket.on('room:joined', (data) => {
  console.log('[P2] joined room', data.roomId, 'as', data.player.username)
})

socket.on('room:state', (state) => {
  console.log('[P2] room state:', state.phase, 'round', state.round)
  if (state.phase === 'playing' && state.pair) {
    const [a, b] = state.pair
    console.log(
      '[P2] round pair:', a.name_cn, a.score, 'vs', b.name_cn, b.score,
    )
    // Pick the first one (always pick anime A) after a short delay
    setTimeout(() => {
      console.log('[P2] picking anime A (id=' + a.id + ')')
      socket.emit('game:pick', { animeId: a.id })
    }, 500)
  }
  if (state.phase === 'reveal') {
    console.log('[P2] reveal — scores:', state.scores)
  }
  if (state.phase === 'finished') {
    console.log('[P2] game finished, scores:', state.scores)
    socket.disconnect()
    process.exit(0)
  }
})

socket.on('room:error', (data) => {
  console.error('[P2] error:', data.message)
})

socket.on('disconnect', () => {
  console.log('[P2] disconnected')
})

// After 3s, request to start the game (we're not host, so will get error)
setTimeout(() => {
  console.log('[P2] requesting game start (will fail since not host)')
  socket.emit('game:start', {})
}, 3000)

// Keep alive for 60s
setTimeout(() => {
  console.log('[P2] timeout, exiting')
  socket.disconnect()
  process.exit(0)
}, 60000)
