import { App } from './app'
import { User } from './user'
import { Game } from './game'

import { Command, Event } from 'common'

import * as fs from 'fs'
import Ws from 'ws'
import { encode } from '@msgpack/msgpack'

export class Room {
	private readonly _users: User[] = []
	private readonly _app = new App()
	private _game: Game | undefined

	private _dict: string[]

	constructor(_s: Ws.Server) {
		const text = fs.readFileSync('./jisyo.txt', { encoding: 'utf-8' })
		this._dict = text.split('\n')
	}

	get users(): readonly User[] {
		return this._users
	}

	private _broadcastEvent(event: Event): void {
		const encoded = encode(event)
		for (const user of this._users) {
			const conn = user.conn
			if (conn === undefined) {
				continue
			}

			conn.send(encoded)
		}
	}

	private _sendEventTo(user: User, event: Event): void {
		const encoded = encode(event)
		const conn = user.conn
		if (conn === undefined) {
			return
		}

		conn.send(encoded)
	}

	onUserJoined(user: User): void {
		if (this._users.includes(user)) {
			this._onUserReconnected(user)
			return
		}

		this._users.push(user)
		user.setJoinedRoom(this)

		this._game?.onUserLoggedIn(user)

		this._broadcastEvent({
			kind: 'userLoggedIn',
			userId: user.userId,
			name: user.name,
		})

		this._onUserReconnected(user)
	}

	private _onUserReconnected(user: User) {
		if (this._game === undefined) {
			return
		}

		this._sendEventTo(user, {
			kind: 'gameStateChanged',
			value: this._game.getCurrentStateOf(user),
		})
	}

	onGameStateChanged(): void {
		if (this._game === undefined) {
			throw 'unrechable!'
		}

		for (const user of this._users) {
			this._sendEventTo(user, {
				kind: 'gameStateChanged',
				value: this._game.getCurrentStateOf(user),
			})
		}
	}

	resetCanvas(): void {
		this._app.resetCanvas()

		void (async () => {
			// TODO: Eventの構築中に他のメッセージが送信されないようにする
			this._broadcastEvent({
				kind: 'canvasStateSet',
				value: await this._app.eventExecutor.reExecutor
					.getLastRenderedImageModel()
					.serialize(),
				log: this._app.eventMgr.history,
			})
		})()
	}

	private _handleChat(user: User, msg: string): void {
		this._broadcastEvent({
			kind: 'chatSent',
			userId: user.userId,
			name: user.name,
			message: msg,
		})

		if (msg === '!list') {
			this._broadcastEvent({
				kind: 'chatSent',
				userId: 'system',
				name: 'system',
				message: '\n' + this._users.map((x) => `${x.userId}: ${x.name}`).join('\n'),
			})
			return
		}

		if (msg === '!reset') {
			this._game?.stop()
			this._game = new Game(this._dict, this)
			this._game.start()
			return
		}

		this._game?.onMessage(user, msg)
	}

	handleRoomCommand(user: User, cmd: Command): void {
		if (cmd.kind === 'sendChat') {
			this._handleChat(user, cmd.message)
		}

		if (cmd.kind === 'requestData') {
			void (async () => {
				// TODO: Eventの構築中に他のメッセージが送信されないようにする
				const event: Event = {
					kind: 'canvasStateSet',
					value: await this._app.eventExecutor.reExecutor
						.getLastRenderedImageModel()
						.serialize(),
					log: this._app.eventMgr.history,
				}
				user.conn!.send(encode(event))
			})()
		}

		if (cmd.kind === 'imageCanvasCommand') {
			const canvasEvent = this._app.cmdInterpreter.command(user.userId, cmd.value)
			if (canvasEvent === undefined) {
				console.log('不正なコマンド', cmd.value)
				return
			}

			this._broadcastEvent({
				kind: 'imageCanvasEvent',
				value: canvasEvent,
			})
		}
	}
}
