import * as ws from 'ws'
import { createCanvas, Canvas } from 'canvas'
import { decode, encode } from '@msgpack/msgpack'
import Crypto from 'crypto'

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
	UserId,
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

	constructor(
		private readonly _drawer: ImageCanvasDrawer,
		private readonly _manager: ImageCanvasEventManager
	) {
		this._revoker = new ImageCanvasEventRevoker(this._manager)
	}

	private _isLayerFound(layerId: LayerId): boolean {
		return this._drawer.findLayerModelById(layerId) !== undefined
	}

	command(userId: UserId, cmd: ImageCanvasCommand): ImageCanvasEvent | undefined {
		if (cmd.kind === 'drawLayer') {
			if (!this._isLayerFound(cmd.layer)) {
				return
			}

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
			if (!this._isLayerFound(cmd.layer)) {
				return
			}

			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerRemoved',
					layerId: cmd.layer,
				})
			)
		} else if (cmd.kind === 'revokeEvent') {
			if (this._revoker.isRevokable(userId, cmd.eventId)) {
				return this._pushEvent(
					this._genEvent(userId, { kind: 'eventRevoked', eventId: cmd.eventId })
				)
			}
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

interface UserData {
	userId: UserId
	name: string
	reconnectionToken: string
}

class UserManager {
	private _currentUserId = 0
	private readonly _users: UserData[] = []

	createUser(name: string): UserData {
		const token = Crypto.randomBytes(16).toString('hex')

		const data = {
			userId: this._currentUserId.toString(),
			name,
			reconnectionToken: token,
		}

		this._currentUserId++
		return data
	}

	findByReconnectionToken(token: string): UserData | undefined {
		return this._users.find((x) => x.reconnectionToken === token)
	}
}

interface ConnectionData {
	userData: UserData | undefined
}

function main() {
	const s = new ws.Server({ port: 25567 })
	const app = new App()
	const userManager = new UserManager()

	s.on('connection', (ws) => {
		const connectionData: ConnectionData = {
			userData: undefined,
		}

		ws.on('message', (message: unknown) => {
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

				connectionData.userData = userData
				const acceptedEvent: Event = {
					kind: 'loginAccepted',
					userId: userData.userId,
					name: userData.name,
					reconnectionToken: userData.reconnectionToken,
				}
				ws.send(encode(acceptedEvent))

				const loggedInEvent: Event = {
					kind: 'userLoggedIn',
					userId: userData.userId,
					name: userData.name,
				}
				const encoded = encode(loggedInEvent)

				s.clients.forEach((client) => {
					client.send(encoded)
				})

				return
			}

			const userData = connectionData.userData
			if (userData === undefined) {
				console.error('非ログイン時の不正なコマンド')
				return
			}

			if (cmd.kind === 'sendChat') {
				const event: Event = {
					kind: 'chatSent',
					userId: userData.userId,
					name: userData.name,
					message: cmd.message,
				}
				const encoded = encode(event)

				s.clients.forEach((client) => {
					client.send(encoded)
				})

				if (cmd.message === '!reset') {
					console.log('canvas reset!')
					app.resetCanvas()
				}

				void (async () => {
					// TODO: Eventの構築中に他のメッセージが送信されないようにする
					const event: Event = {
						kind: 'canvasStateSet',
						value: await app.undoMgr.getLastRenderedImageModel().serialize(),
						log: app.eventMgr.history,
					}
					const encoded = encode(event)
					s.clients.forEach((client) => {
						client.send(encoded)
					})
				})()
			}

			if (cmd.kind === 'requestData') {
				void (async () => {
					// TODO: Eventの構築中に他のメッセージが送信されないようにする
					const event: Event = {
						kind: 'canvasStateSet',
						value: await app.undoMgr.getLastRenderedImageModel().serialize(),
						log: app.eventMgr.history,
					}
					ws.send(encode(event))
				})()
			}

			if (cmd.kind === 'imageCanvasCommand') {
				const canvasEvent = app.cmdInterpreter.command(userData.userId, cmd.value)
				if (canvasEvent === undefined) {
					console.log('不正なコマンド')
					console.log(cmd.value)
					return
				}

				const event: Event = {
					kind: 'imageCanvasEvent',
					value: canvasEvent,
				}
				const encodedEvent = encode(event)

				s.clients.forEach((client) => {
					client.send(encodedEvent)
				})
			}
		})
	})
}

main()
