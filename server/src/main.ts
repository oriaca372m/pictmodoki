import { Room } from './room'
import { User, UserManager } from './user'

import { Command, Event } from 'common'

import Ws from 'ws'
import { decode, encode } from '@msgpack/msgpack'

interface ConnectionData {
	userData: User | undefined
}

function main() {
	const s = new Ws.Server({ port: 25567 })
	const userManager = new UserManager()
	const room = new Room(s)

	s.on('connection', (conn) => {
		const connectionData: ConnectionData = {
			userData: undefined,
		}

		conn.on('close', () => {
			const userData = connectionData.userData
			if (userData !== undefined) {
				userData.conn = undefined
			}
		})

		conn.on('message', (message: unknown) => {
			const cmd = decode(message as Uint8Array) as Command
			console.log(cmd)

			if (cmd.kind === 'login') {
				let userData
				if (cmd.reconnectionToken !== null) {
					userData = userManager.findByReconnectionToken(cmd.reconnectionToken)
				}

				if (userData === undefined) {
					userData = userManager.createUser(cmd.name)
				}

				userData.conn = conn
				connectionData.userData = userData

				const acceptedEvent: Event = {
					kind: 'loginAccepted',
					userId: userData.userId,
					name: userData.name,
					reconnectionToken: userData.reconnectionToken,
				}
				conn.send(encode(acceptedEvent))

				room.onUserJoined(userData)
				return
			}

			const userData = connectionData.userData
			if (userData === undefined) {
				console.error('非ログイン時の不正なコマンド')
				return
			}

			room.handleRoomCommand(userData, cmd)
		})
	})
}

main()
