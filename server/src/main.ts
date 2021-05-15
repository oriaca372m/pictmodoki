import { Room } from './room'
import { User, UserManager } from './user'

import { Command, Event } from 'common'

import Ws from 'ws'
import { decode, encode } from '@msgpack/msgpack'

class Connection {
	private _userData: User | undefined

	constructor(private readonly _server: Server, private readonly _conn: Ws) {
		_conn.on('message', (msg) => {
			this._onMessage(msg)
		})

		_conn.on('close', () => {
			this._onClose()
		})
	}

	private _onMessage(msg: unknown): void {
		const cmd = decode(msg as Uint8Array) as Command
		console.log(cmd)

		if (cmd.kind === 'login') {
			let userData
			if (cmd.reconnectionToken !== null) {
				userData = this._server.userManager.findByReconnectionToken(cmd.reconnectionToken)
			}

			if (userData === undefined) {
				userData = this._server.userManager.createUser(cmd.name)
			}

			userData.conn = this._conn
			this._userData = userData

			const acceptedEvent: Event = {
				kind: 'loginAccepted',
				userId: userData.userId,
				name: userData.name,
				reconnectionToken: userData.reconnectionToken,
			}
			this._conn.send(encode(acceptedEvent))

			this._server.room.onUserJoined(userData)
			return
		}

		const userData = this._userData
		if (userData === undefined) {
			console.error('非ログイン時の不正なコマンド')
			return
		}

		this._server.room.handleRoomCommand(userData, cmd)
	}

	private _onClose(): void {
		if (this._userData !== undefined) {
			this._userData.conn = undefined
		}
	}
}

class Server {
	private readonly _server: Ws.Server
	private readonly _userManager = new UserManager()
	private readonly _room: Room

	constructor(port: number) {
		this._server = new Ws.Server({ port })
		this._room = new Room(this._server)

		this._server.on('connection', (conn) => {
			this._onConnection(conn)
		})
	}

	get userManager(): UserManager {
		return this._userManager
	}

	get room(): Room {
		return this._room
	}

	private _onConnection(conn: Ws): void {
		new Connection(this, conn)
	}
}

new Server(25567)
