import Ws from 'ws'
import { createCanvas, Canvas } from 'canvas'
import { decode, encode } from '@msgpack/msgpack'
import Crypto from 'crypto'
import lodash from 'lodash'

import {
	LayerId,
	CanvasProxy,
	CanvasProxyFactory,
	Size,
	Command,
	Event,
	ImageCanvasEvent,
	ImageCanvasEventType,
	ImageCanvasModel,
	ImageCanvasCommand,
	ImageCanvasDrawer,
	ImageCanvasEventPlayer,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasUndoManager,
	ImageCanvasEventRevoker,
	ImageCanvasCommandValidator,
	UserId,
	GameState,
	GameUserData,
	PaintingData,
} from 'common'

import * as fs from 'fs'

class NodeCanvasProxy implements CanvasProxy {
	private readonly _canvas: Canvas
	constructor(size: Size) {
		this._canvas = createCanvas(size.height, size.width)
	}

	getContext(): CanvasRenderingContext2D {
		return this._canvas.getContext('2d')
	}

	drawSelfTo(ctx: CanvasRenderingContext2D): void {
		ctx.drawImage((this._canvas as unknown) as OffscreenCanvas, 0, 0)
	}

	get size(): Size {
		return { width: this._canvas.width, height: this._canvas.height }
	}

	serialize(): Promise<Uint8Array> {
		const buf = this._canvas.toBuffer()
		return Promise.resolve(new Uint8Array(buf))
	}

	saveFile(path: string): void {
		const out = fs.createWriteStream(path)
		const stream = this._canvas.createPNGStream()
		stream.pipe(out)
	}
}

class NodeCanvasProxyFactory implements CanvasProxyFactory {
	createCanvasProxy(size: Size): NodeCanvasProxy {
		return new NodeCanvasProxy(size)
	}
}

class EventRenderer implements ImageCanvasEventManagerPlugin {
	private readonly _player: ImageCanvasEventPlayer
	constructor(private readonly _app: App) {
		this._player = new ImageCanvasEventPlayer(_app.drawer)
	}

	onEvent(event: ImageCanvasEvent): void {
		if (event.eventType.kind === 'eventRevoked') {
			return
		}

		this._player.playSingleEvent(event)
	}

	onHistoryChanged(): void {
		const model = this._app.undoMgr.createUndoedImageCanvasModel()
		this._app.drawer.setModel(model)
	}

	onHistoryWiped(): void {
		// pass
	}
}

class App {
	size: Size
	factory: NodeCanvasProxyFactory
	drawer: ImageCanvasDrawer
	eventMgr: ImageCanvasEventManager
	undoMgr: ImageCanvasUndoManager
	targetCanvas: NodeCanvasProxy
	cmdInterpreter: CommandInterpreter

	constructor() {
		this.size = { width: 2000, height: 2000 }
		this.factory = new NodeCanvasProxyFactory()
		this.targetCanvas = this.factory.createCanvasProxy(this.size)

		// 特に使用されないので小さめのサイズで作る
		const model = new ImageCanvasModel({ width: 256, height: 256 })
		this.drawer = new ImageCanvasDrawer(model, this.factory)

		this.eventMgr = new ImageCanvasEventManager()
		this.eventMgr.registerPlugin(new EventRenderer(this))

		this.undoMgr = new ImageCanvasUndoManager(this.eventMgr, this.factory, model)
		this.eventMgr.registerPlugin(this.undoMgr)

		this.cmdInterpreter = new CommandInterpreter(this.drawer, this.eventMgr)
		this.resetCanvas()
	}

	resetCanvas(): void {
		const model = new ImageCanvasModel(this.size)
		this.undoMgr.setLastRenderedImageModel(model)
		this.eventMgr.setHistory([])

		this.cmdInterpreter.command('system', { kind: 'createLayer' })
		this.cmdInterpreter.command('system', { kind: 'createLayer' })
	}
}

export class CommandInterpreter {
	private _eventId = 0
	private _layerId = 0
	private readonly _revoker: ImageCanvasEventRevoker
	private readonly _validator: ImageCanvasCommandValidator

	constructor(
		private readonly _drawer: ImageCanvasDrawer,
		private readonly _manager: ImageCanvasEventManager
	) {
		this._revoker = new ImageCanvasEventRevoker(this._manager)
		this._validator = new ImageCanvasCommandValidator(_drawer, this._revoker)
	}

	private _isLayerFound(layerId: LayerId): boolean {
		return this._drawer.findLayerModelById(layerId) !== undefined
	}

	command(userId: UserId, cmd: ImageCanvasCommand): ImageCanvasEvent | undefined {
		if (!this._validator.validate(userId, cmd)) {
			return
		}

		if (cmd.kind === 'drawLayer') {
			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerDrawn',
					layerId: cmd.layer,
					drawCommand: cmd.drawCommand,
				})
			)
		} else if (cmd.kind === 'createLayer') {
			const event = this._genEvent(userId, {
				kind: 'layerCreated',
				layerId: this._layerId.toString(),
			})
			this._pushEvent(event)
			this._layerId++
			return event
		} else if (cmd.kind === 'removeLayer') {
			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerRemoved',
					layerId: cmd.layer,
				})
			)
		} else if (cmd.kind === 'revokeEvent') {
			return this._pushEvent(
				this._genEvent(userId, { kind: 'eventRevoked', eventId: cmd.eventId })
			)
		} else if (cmd.kind === 'setLayerOrder') {
			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerOrderChanged',
					order: cmd.order,
				})
			)
		}
	}

	private _genEvent(userId: UserId, eventType: ImageCanvasEventType): ImageCanvasEvent {
		return {
			id: this._eventId.toString(),
			userId,
			isRevoked: false,
			isVirtual: false,
			eventType,
		}
	}

	private _pushEvent(event: ImageCanvasEvent): ImageCanvasEvent {
		this._manager.event(event)
		this._eventId++
		return event
	}
}

class User {
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

class UserManager {
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

interface ConnectionData {
	userData: User | undefined
}

class Game {
	private _respondent: string | undefined
	private _respondentScore: number | undefined

	private _paintingData!: PaintingData
	private _nextPaintingData: PaintingData | undefined
	private _state: 'painting' | 'waitingNext' | 'finished' = 'painting'

	constructor(private readonly _dict: string[], private readonly _room: Room) {}

	start() {
		this._nextPaintingData = {
			painter: this._room.users[0].userId,
			answer: lodash.sample(this._dict),
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
		clone.answer = undefined
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

	onMessage(msgUser: User, msg: string): void {
		console.log(this._state)
		console.log(msg)
		if (this._state !== 'painting') {
			return
		}

		if (this._paintingData.answer === msg) {
			this._respondent = msgUser.userId
			this._respondentScore = 100
			this._state = 'waitingNext'

			const nextPainter = this._findNextPainter(this._paintingData.painter)

			this._nextPaintingData = {
				painter: nextPainter.userId,
				answer: lodash.sample(this._dict),
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
			point: 0,
		}))
	}

	onUserLoggedIn(_user: User): void {
		// pass
	}
}

class Room {
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

	onUserJoined(user: User) {
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
		console.log('canvas reset!')
		this._app.resetCanvas()

		void (async () => {
			// TODO: Eventの構築中に他のメッセージが送信されないようにする
			this._broadcastEvent({
				kind: 'canvasStateSet',
				value: await this._app.undoMgr.getLastRenderedImageModel().serialize(),
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
					value: await this._app.undoMgr.getLastRenderedImageModel().serialize(),
					log: this._app.eventMgr.history,
				}
				user.conn!.send(encode(event))
			})()
		}

		if (cmd.kind === 'imageCanvasCommand') {
			const canvasEvent = this._app.cmdInterpreter.command(user.userId, cmd.value)
			if (canvasEvent === undefined) {
				console.log('不正なコマンド')
				console.log(cmd.value)
				return
			}

			this._broadcastEvent({
				kind: 'imageCanvasEvent',
				value: canvasEvent,
			})
		}
	}
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
				if (cmd.reconnectionToken !== undefined) {
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
