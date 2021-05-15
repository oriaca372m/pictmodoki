import { Room } from './room'

import { UserId } from 'common'

import Ws from 'ws'
import Crypto from 'crypto'

export class User {
	private readonly _reconnectionToken: string
	private _joinedRoom: Room | undefined
	conn: Ws | undefined

	constructor(private readonly _userId: UserId, private readonly _name: string) {
		this._reconnectionToken = Crypto.randomBytes(16).toString('hex')
	}

	get userId(): UserId {
		return this._userId
	}

	get name(): string {
		return this._name
	}

	get reconnectionToken(): string {
		return this._reconnectionToken
	}

	setJoinedRoom(room: Room): void {
		this._joinedRoom = room
	}

	get joinedRoom(): Room | undefined {
		return this._joinedRoom
	}
}

export class UserManager {
	private _currentUserId = 0
	private readonly _users: User[] = []

	createUser(name: string): User {
		const user = new User(this._currentUserId.toString(), name)
		this._users.push(user)

		this._currentUserId++
		return user
	}

	findByReconnectionToken(token: string): User | undefined {
		return this._users.find((x) => x.reconnectionToken === token)
	}
}
