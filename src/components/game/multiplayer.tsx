'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  Crown,
  Users,
  Play,
  LogOut,
  Flame,
  Star,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import FilterBar from './filter-bar';
import AnimeCard from './anime-card';
import { useGameStore, type AnimeFilters } from '@/lib/game-store';
import type { AnimeListItem } from '@/lib/bangumi';
import { toast } from 'sonner';

// ---- Types matching the server-side protocol ------------------------------

interface PlayerInfo {
  id: string
  username: string
  isHost: boolean
}

interface RoomState {
  roomId: string
  round: number
  totalRounds: number
  phase: 'waiting' | 'playing' | 'reveal' | 'finished'
  scores: Record<string, number>
  players: PlayerInfo[]
  pair: AnimeListItem[] | null
  aIsCarryOver: boolean
  picks: Record<string, { animeId: number; picked: boolean }>
}

interface RoundEndPayload {
  correctId: number
  updates: Record<string, { delta: number; correct: boolean }>
  scores: Record<string, number>
  round: number
}

interface GameEndPayload {
  winnerId: string | null
  finalScores: Record<string, number>
}

interface MultiplayerProps {
  onExit: () => void
}

type LobbyView = 'choose' | 'create' | 'join' | 'room'

export default function Multiplayer({ onExit }: MultiplayerProps) {
  const { filters, setFilters } = useGameStore()

  // Connection state
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  // Lobby state
  const [view, setView] = useState<LobbyView>('choose')
  const [username, setUsername] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Game state
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [roundLoading, setRoundLoading] = useState(false)
  const [roundEnd, setRoundEnd] = useState<RoundEndPayload | null>(null)
  const [gameEnd, setGameEnd] = useState<GameEndPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingPair, setPendingPair] = useState<AnimeListItem[] | null>(null)
  const [myId, setMyId] = useState<string | null>(null)

  // Init socket on mount
  useEffect(() => {
    const s = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = s

    s.on('connect', () => {
      setConnected(true)
      setMyId(s.id ?? null)
    })
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))

    s.on('room:state', (state: RoomState) => {
      setRoomState(state)
      if (state.phase === 'playing') {
        setRoundEnd(null)
        if (state.pair) {
          setPendingPair(state.pair)
          setRoundLoading(false)
        }
      }
      if (state.phase === 'reveal') {
        setRoundEnd((prev) => prev) // keep existing round end
      }
      if (state.phase === 'finished') {
        // gameEnd handler will fire
      }
      if (state.phase === 'waiting') {
        setPendingPair(null)
        setRoundEnd(null)
      }
    })

    s.on('room:created', (data: { roomId: string; player: PlayerInfo }) => {
      setRoomId(data.roomId)
      setView('room')
    })

    s.on('room:joined', (data: { roomId: string; player: PlayerInfo }) => {
      setRoomId(data.roomId)
      setView('room')
    })

    s.on('room:error', (data: { message: string }) => {
      setError(data.message)
      toast.error(data.message)
    })

    s.on('game:loading', () => {
      setRoundLoading(true)
      setPendingPair(null)
      setRoundEnd(null)
    })

    s.on(
      'game:round',
      (data: { round: number; totalRounds: number; pair: AnimeListItem[] }) => {
        setPendingPair(data.pair)
        setRoundLoading(false)
        setRoundEnd(null)
      },
    )

    s.on('game:pick', (_data: { playerId: string; animeId: number }) => {
      // picked state is updated via room:state
    })

    s.on('game:round_end', (data: RoundEndPayload) => {
      setRoundEnd(data)
    })

    s.on('game:end', (data: GameEndPayload) => {
      setGameEnd(data)
    })

    return () => {
      s.disconnect()
    }
  }, [])

  // ---- Actions ----------------------------------------------------------

  const handleCreate = useCallback(() => {
    if (!username.trim()) {
      toast.error('请输入昵称')
      return
    }
    setError(null)
    socketRef.current?.emit('room:create', { username: username.trim() })
  }, [username])

  const handleJoin = useCallback(() => {
    if (!username.trim()) {
      toast.error('请输入昵称')
      return
    }
    if (!joinCode.trim()) {
      toast.error('请输入房间号')
      return
    }
    setError(null)
    socketRef.current?.emit('room:join', {
      roomId: joinCode.trim().toUpperCase(),
      username: username.trim(),
    })
  }, [username, joinCode])

  const handleStartGame = useCallback(() => {
    socketRef.current?.emit('game:start', { filters })
  }, [filters])

  const handlePick = useCallback(
    (animeId: number) => {
      socketRef.current?.emit('game:pick', { animeId })
    },
    [],
  )

  const handleNext = useCallback(() => {
    socketRef.current?.emit('game:next')
  }, [])

  const handleLeaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave')
    setRoomId(null)
    setRoomState(null)
    setPendingPair(null)
    setRoundEnd(null)
    setGameEnd(null)
    setView('choose')
  }, [])

  const handleCopyCode = useCallback(async () => {
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      toast.success('房间号已复制')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }, [roomId])

  // ---- Render: Game in progress --------------------------------------

  const opponent = roomState?.players.find((p) => p.id !== myId) ?? null
  const me = roomState?.players.find((p) => p.id === myId) ?? null
  const isHost = me?.isHost ?? false
  const myScore = (myId && roomState?.scores[myId]) ?? 0
  const oppScore = (opponent && roomState?.scores[opponent.id]) ?? 0
  const myPick = (myId && roomState?.picks[myId]?.animeId) ?? null
  const oppPicked = opponent ? !!roomState?.picks[opponent.id] : false
  const phase = roomState?.phase ?? 'waiting'

  // ---- Render: Lobby -------------------------------------------------

  if (view !== 'room' || !roomId) {
    return (
      <MultiplayerLobby
        connected={connected}
        view={view}
        setView={setView}
        username={username}
        setUsername={setUsername}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onExit={onExit}
        error={error}
      />
    )
  }

  // ---- Render: Game over --------------------------------------------

  if (gameEnd) {
    const won = gameEnd.winnerId === myId
    const tied = gameEnd.winnerId === null
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card className="overflow-hidden">
          <div
            className={
              'p-8 text-center text-white ' +
              (won
                ? 'bg-gradient-to-br from-amber-500 via-rose-500 to-pink-600'
                : tied
                  ? 'bg-gradient-to-br from-slate-500 to-slate-700'
                  : 'bg-gradient-to-br from-slate-600 to-rose-700')
            }
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              {won ? (
                <Crown className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
              ) : (
                <Users className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
              )}
              <p className="text-sm uppercase tracking-wider opacity-90">
                {won ? '你赢了！' : tied ? '平局！' : '挑战失败'}
              </p>
              <h2 className="mt-1 text-5xl font-extrabold tabular-nums drop-shadow">
                {myScore} : {oppScore}
              </h2>
              <p className="mt-1 text-sm opacity-90">
                {me?.username} vs {opponent?.username ?? '对手'}
              </p>
            </motion.div>
          </div>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {won
                ? '出色的眼力！要不要再来一局？'
                : tied
                  ? '势均力敌！再来一局分高下'
                  : '不要灰心，再战一局！'}
            </p>
            <div className="flex gap-2">
              {isHost && (
                <Button
                  onClick={() => {
                    setGameEnd(null)
                    handleStartGame()
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <Play className="w-4 h-4 mr-1" />
                  再来一局
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleLeaveRoom}
                className="flex-1"
              >
                <LogOut className="w-4 h-4 mr-1" />
                离开房间
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Render: Main game UI ------------------------------------------

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLeaveRoom}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          离开房间
        </Button>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{
              background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: connected ? '#059669' : '#dc2626',
            }}
          >
            {connected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {connected ? '已连接' : '断开'}
          </div>
          {/* Room code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
            title="点击复制房间号"
          >
            房间 #{roomId}
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Players & scores */}
      <div className="grid grid-cols-2 gap-3">
        <PlayerScoreCard
          name={me?.username ?? '你'}
          score={myScore}
          isMe
          picked={!!myPick}
          phase={phase}
        />
        <PlayerScoreCard
          name={opponent?.username ?? '等待中…'}
          score={oppScore}
          isMe={false}
          picked={oppPicked}
          phase={phase}
          isWaiting={!opponent}
        />
      </div>

      {/* Progress */}
      {roomState && phase !== 'waiting' && (
        <Progress
          value={(roomState.round / roomState.totalRounds) * 100}
          className="h-1"
        />
      )}

      {/* Waiting for opponent */}
      {phase === 'waiting' && (
        <Card className="border-rose-200 dark:border-rose-900/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">房间已就绪</h3>
                <p className="text-sm text-muted-foreground">
                  把房间号分享给好友让他们加入
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                disabled={!roomId}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                复制房间号
              </Button>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">房间号</p>
              <p className="text-3xl font-extrabold tracking-[0.2em] text-rose-600 dark:text-rose-300">
                {roomId}
              </p>
            </div>

            <FilterBar
              key={`${filters.yearStart}-${filters.yearEnd}-${filters.minRatingCount}`}
              filters={filters}
              onChange={setFilters}
              onApply={() => toast.success('筛选已更新')}
              disabled={!isHost}
            />

            <div className="rounded-lg border border-dashed border-rose-200 dark:border-rose-900/40 p-4 text-center text-sm text-muted-foreground">
              {opponent ? (
                <span className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  玩家已就位：
                  <span className="font-semibold text-foreground">
                    {me?.username}
                  </span>
                  {'  '}vs{'  '}
                  <span className="font-semibold text-foreground">
                    {opponent.username}
                  </span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  等待对手加入房间…
                </span>
              )}
            </div>

            <Button
              onClick={handleStartGame}
              disabled={!isHost || !opponent}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Play className="w-4 h-4 mr-1" />
              {isHost
                ? opponent
                  ? '开始游戏'
                  : '等待对手加入…'
                : '等待房主开始游戏'}
            </Button>
            {!isHost && (
              <p className="text-xs text-center text-muted-foreground">
                只有房主可以开始游戏
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Playing phase */}
      {(phase === 'playing' || phase === 'reveal') && (
        <div className="relative">
          {roundLoading || !pendingPair ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-10 h-10 animate-spin text-rose-500 mb-3" />
              <p className="text-sm">正在抽取第 {roomState?.round} 题……</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 max-w-3xl mx-auto">
              <AnimeCard
                anime={pendingPair[0]}
                side="A"
                onPick={handlePick}
                revealed={phase === 'reveal'}
                isWinner={
                  roundEnd?.correctId === pendingPair[0].id
                }
                isPicked={myPick === pendingPair[0].id}
                disabled={!!myPick}
                isCarryOver={roomState?.aIsCarryOver ?? false}
              />
              <AnimeCard
                anime={pendingPair[1]}
                side="B"
                onPick={handlePick}
                revealed={phase === 'reveal'}
                isWinner={
                  roundEnd?.correctId === pendingPair[1].id
                }
                isPicked={myPick === pendingPair[1].id}
                disabled={!!myPick}
              />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-card border-2 border-rose-500 dark:border-rose-400 shadow-lg flex items-center justify-center">
                  <span className="text-rose-600 dark:text-rose-300 font-extrabold text-sm sm:text-base">
                    VS
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Opponent status */}
          {phase === 'playing' && pendingPair && (
            <div className="mt-4 max-w-3xl mx-auto flex justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                {oppPicked ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    对手已选择，等你出手
                  </>
                ) : myPick ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    等待对手选择…
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    比拼速度，先答对者获得 +5 速度加成
                  </>
                )}
              </div>
            </div>
          )}

          {/* Round end banner */}
          <AnimatePresence>
            {phase === 'reveal' && roundEnd && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 max-w-3xl mx-auto"
              >
                <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10">
                  <CardContent className="p-4 space-y-3">
                    {myId && roundEnd.updates[myId] && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">你的得分</span>
                        <span
                          className={
                            'text-lg font-bold tabular-nums ' +
                            (roundEnd.updates[myId].correct
                              ? 'text-green-600'
                              : 'text-red-600')
                          }
                        >
                          {roundEnd.updates[myId].delta > 0 ? '+' : ''}
                          {roundEnd.updates[myId].delta}
                        </span>
                      </div>
                    )}
                    {opponent && roundEnd.updates[opponent.id] && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {opponent.username}
                        </span>
                        <span
                          className={
                            'text-lg font-bold tabular-nums ' +
                            (roundEnd.updates[opponent.id].correct
                              ? 'text-green-600'
                              : 'text-red-600')
                          }
                        >
                          {roundEnd.updates[opponent.id].delta > 0 ? '+' : ''}
                          {roundEnd.updates[opponent.id].delta}
                        </span>
                      </div>
                    )}
                    {isHost && (
                      <Button
                        onClick={handleNext}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                        size="sm"
                      >
                        下一题 →
                      </Button>
                    )}
                    {!isHost && (
                      <p className="text-xs text-center text-muted-foreground">
                        等待房主进入下一题…
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ---- Sub-components -------------------------------------------------------

function PlayerScoreCard({
  name,
  score,
  isMe,
  picked,
  phase,
  isWaiting,
}: {
  name: string
  score: number
  isMe: boolean
  picked: boolean
  phase: string
  isWaiting?: boolean
}) {
  return (
    <div
      className={
        'rounded-2xl border p-3 flex items-center gap-3 transition-colors ' +
        (isMe
          ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800/40'
          : 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-900/40')
      }
    >
      <div
        className={
          'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ' +
          (isMe
            ? 'bg-rose-500 text-white'
            : 'bg-amber-500 text-white')
        }
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{name}</span>
          {isMe && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200">
              我
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          <span className="font-bold tabular-nums">{score}</span>
          {phase === 'playing' && (
            <span className="ml-2 text-muted-foreground">
              {isWaiting
                ? '等待加入…'
                : picked
                  ? '已选择'
                  : '思考中…'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function MultiplayerLobby({
  connected,
  view,
  setView,
  username,
  setUsername,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  onExit,
  error,
}: {
  connected: boolean
  view: LobbyView
  setView: (v: LobbyView) => void
  username: string
  setUsername: (s: string) => void
  joinCode: string
  setJoinCode: (s: string) => void
  onCreate: () => void
  onJoin: () => void
  onExit: () => void
  error: string | null
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          主菜单
        </Button>
        <div
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
          style={{
            background: connected
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(239,68,68,0.15)',
            color: connected ? '#059669' : '#dc2626',
          }}
        >
          {connected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {connected ? '服务器已连接' : '正在连接…'}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold text-center mb-1">多人联机大厅</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          创建房间或输入好友的房间号加入对战
        </p>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">昵称</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="你的昵称（最多 20 字符）"
                maxLength={20}
                disabled={!connected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && view === 'create') onCreate()
                  if (e.key === 'Enter' && view === 'join') onJoin()
                }}
              />
            </div>

            {view === 'choose' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => setView('create')}
                  disabled={!connected}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  创建房间
                </Button>
                <Button
                  onClick={() => setView('join')}
                  disabled={!connected}
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                >
                  加入房间
                </Button>
              </div>
            )}

            {view === 'create' && (
              <div className="space-y-3 pt-2">
                <Button
                  onClick={onCreate}
                  disabled={!connected || !username.trim()}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                >
                  创建并进入房间
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('choose')}
                  className="w-full"
                >
                  返回
                </Button>
              </div>
            )}

            {view === 'join' && (
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="roomcode">房间号</Label>
                  <Input
                    id="roomcode"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    placeholder="6 位房间号"
                    maxLength={6}
                    className="text-center text-2xl font-mono tracking-[0.3em]"
                    disabled={!connected}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onJoin()
                    }}
                  />
                </div>
                <Button
                  onClick={onJoin}
                  disabled={
                    !connected || !username.trim() || joinCode.length !== 6
                  }
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                >
                  加入房间
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('choose')}
                  className="w-full"
                >
                  返回
                </Button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 dark:bg-red-950/20 p-2 rounded">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 rounded-xl bg-rose-50 dark:bg-rose-950/10 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-rose-700 dark:text-rose-200 mb-1">
            联机玩法（链式对战）
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>房主创建房间，得到 6 位房间号</li>
            <li>对手输入房间号加入房间</li>
            <li>房主可调整筛选条件（年份 / 评分区间 / 评分人数）并开始游戏</li>
            <li>第 1 题随机抽取两部番剧；第 2 题起，上题的 B 变为 A，再补一个新 B</li>
            <li>共 10 题，先答对得 +5 速度加成，答错扣 3 分</li>
          </ul>
        </div>
      </motion.div>
    </div>
  )
}
