import { User } from './user'
import { Room } from './room'

import { UserId, GameState, GameUserData, PaintingData } from 'common'

import lodash from 'lodash'

export class Game {
	private _respondent: string | undefined
	private _respondentScore: number | undefined

	private readonly _score = new Map<UserId, number>()

	private _paintingData!: PaintingData
	private _nextPaintingData: PaintingData | undefined
	private _state: 'painting' | 'waitingNext' | 'finished' = 'painting'

	constructor(private readonly _dict: string[], private readonly _room: Room) {}

	start(): void {
		this._nextPaintingData = {
			painter: this._room.users[0].userId,
			answer: lodash.sample(this._dict) ?? null,
			timeLeft: 1800,
			timeLimit: 1800,
		}

		this._startNextPainting()
	}

	private _findNextPainter(current: UserId): User {
		const users = this._room.users

		let nextPainterIdx = users.findIndex((x) => x.userId === current)
		nextPainterIdx++

		if (!(nextPainterIdx < users.length)) {
			nextPainterIdx = 0
		}

		return users[nextPainterIdx]
	}

	private _maskSecretPaintingData(original: PaintingData): PaintingData {
		const clone = lodash.cloneDeep(original)
		clone.answer = null
		return clone
	}

	private _startNextPainting(): void {
		if (this._nextPaintingData === undefined) {
			throw 'unrechable!'
		}

		this._state = 'painting'
		this._paintingData = this._nextPaintingData!
		this._nextPaintingData = undefined

		this._room.onGameStateChanged()
		this._room.resetCanvas()
	}

	private _addScore(user: UserId, amount: number): void {
		const score = this._score.get(user) ?? 0
		this._score.set(user, score + amount)
	}

	onMessage(msgUser: User, msg: string): void {
		if (this._state !== 'painting') {
			return
		}

		if (this._paintingData.answer === msg) {
			this._respondent = msgUser.userId
			this._respondentScore = 100
			this._state = 'waitingNext'

			this._addScore(msgUser.userId, this._respondentScore)
			this._addScore(this._paintingData.painter, this._respondentScore * 2)

			const nextPainter = this._findNextPainter(this._paintingData.painter)

			this._nextPaintingData = {
				painter: nextPainter.userId,
				answer: lodash.sample(this._dict) ?? null,
				timeLeft: 1800,
				timeLimit: 1800,
			}

			this._room.onGameStateChanged()

			setTimeout(() => {
				this._startNextPainting()
			}, 10000)
		}
	}

	getCurrentStateOf(user: User): GameState {
		const userData = this._makeGameUserData()

		if (this._state === 'painting') {
			const data = this._paintingData
			const masked = this._maskSecretPaintingData(data)

			return {
				mode: 'normal',
				limitPaintingToPainter: false,
				userData,
				state: {
					kind: 'painting',
					value: data.painter === user.userId ? data : masked,
				},
			}
		}

		if (this._state === 'waitingNext') {
			const next = this._nextPaintingData!
			const maskedNext = this._maskSecretPaintingData(next)

			return {
				mode: 'normal',
				limitPaintingToPainter: false,
				userData,
				state: {
					kind: 'waitingNext',
					value: {
						respondent: this._respondent!,
						score: this._respondentScore!,
						currentPainting: this._paintingData,
						nextPainting: user.userId === next.painter ? next : maskedNext,
					},
				},
			}
		}

		if (this._state === 'finished') {
			return {
				mode: 'normal',
				limitPaintingToPainter: false,
				userData,
				state: { kind: 'finished' },
			}
		}

		throw 'unrechable!'
	}

	private _makeGameUserData(): GameUserData[] {
		return this._room.users.map((x) => ({
			userId: x.userId,
			name: x.name,
			point: this._score.get(x.userId) ?? null,
		}))
	}

	onUserLoggedIn(_user: User): void {
		// pass
	}
}
