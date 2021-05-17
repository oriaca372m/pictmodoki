import { TypedEvent } from './typed-event'
import { UserId } from 'common'

export interface UserInfo {
	id: UserId
	name: string
	score: number
}

export class UserManager {
	private _users: UserInfo[] = []
	readonly updated = new TypedEvent<void>()

	update(users: UserInfo[]): void {
		this._users = users
		this.updated.emit()
	}

	get users(): readonly UserInfo[] {
		return this._users
	}

	getUserById(id: UserId): UserInfo | undefined {
		return this._users.find((x) => x.id === id)
	}
}
