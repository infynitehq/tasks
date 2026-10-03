// A thin interface over Trystero so the session and pairing logic can be
// driven by an in-memory fake in tests.

export interface Channel {
  send(data: unknown, peerId?: string): void
  onMessage(fn: (data: unknown, peerId: string) => void): void
}

export interface RoomHandle {
  selfId: string
  channel(name: string): Channel
  onPeerJoin(fn: (peerId: string) => void): void
  onPeerLeave(fn: (peerId: string) => void): void
  leave(): Promise<void>
}

export type JoinRoom = (roomId: string, password: string) => Promise<RoomHandle>

export const APP_ID = "minimal-todos.sync.v1"

/** Joins a Trystero room. Loaded lazily so sync costs nothing until used. */
export const joinTrystero: JoinRoom = async (roomId, password) => {
  const t = await import("trystero")
  const room = t.joinRoom({ appId: APP_ID, password }, roomId)

  const joins: ((id: string) => void)[] = []
  const leaves: ((id: string) => void)[] = []
  room.onPeerJoin = (id: string) => joins.forEach((fn) => fn(id))
  room.onPeerLeave = (id: string) => leaves.forEach((fn) => fn(id))

  return {
    selfId: t.selfId,
    channel(name) {
      const handlers: ((d: unknown, id: string) => void)[] = []
      const action = room.makeAction(name, {
        onMessage: (data, { peerId }) => handlers.forEach((fn) => fn(data, peerId)),
      })
      return {
        send(data, peerId) {
          // Trystero types JSON values; our messages are plain JSON objects.
          void action.send(data as never, peerId ? { target: peerId } : undefined)
        },
        onMessage(fn) {
          handlers.push(fn)
        },
      }
    },
    onPeerJoin(fn) {
      joins.push(fn)
    },
    onPeerLeave(fn) {
      leaves.push(fn)
    },
    async leave() {
      await room.leave()
    },
  }
}
