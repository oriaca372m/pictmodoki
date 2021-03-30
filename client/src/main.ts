import {
	ImageCanvasModel,
	SerializedImageCanvasModel,
	ImageCanvasEvent,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasEventPlayer,
	ImageCanvasUndoManager,
	LayerCanvasModel,
	SerializedLayerCanvasModel,
	ImageCanvasEventRevoker,
	Position,
	UserId,
} from 'common'

import { CommandSender, SocketCommandSender } from './event-sender'
import { WebSocketApi } from './web-socket-api'
import { PaintTool, PenTool } from './paint-tool'
import { OffscreenCanvasProxyFactory, WebCanvasProxy } from './canvas-proxy'
import { LayerManager } from './layer-manager'
import { TypedEvent } from './typed-event'
import { ImageCanvasDrawerWithPreview } from './image-canvas-drawer-with-preview'

import Vue from 'vue'
import VueRouter from 'vue-router'
import VueIndex from './views/index.vue'
import VueHome from './views/home.vue'
import VueRoom from './views/room.vue'

class EventRenderer implements ImageCanvasEventManagerPlugin {
	private readonly _player: ImageCanvasEventPlayer
	constructor(private readonly _app: PaintApp) {
		this._player = new ImageCanvasEventPlayer(_app.imageCanvas)
	}

	onEvent(event: ImageCanvasEvent): void {
		if (event.eventType.kind === 'eventRevoked') {
			return
		}

		this._player.playSingleEvent(event)
		this._app.layerManager.update()
		this._app.render()
	}

	onHistoryChanged(): void {
		const model = this._app.undoManager.createUndoedImageCanvasModel()
		this._app.imageCanvas.setModel(model)
		this._app.layerManager.update()
		this._app.render()
	}

	onHistoryWiped(): void {
		// pass
	}
}

export class PaintApp {
	canvasProxy: WebCanvasProxy
	imageCanvas: ImageCanvasDrawerWithPreview
	penTool: PenTool
	activeTool: PaintTool | undefined
	commandSender!: CommandSender
	eventManager: ImageCanvasEventManager
	undoManager: ImageCanvasUndoManager
	factory: OffscreenCanvasProxyFactory
	revoker: ImageCanvasEventRevoker
	layerManager: LayerManager
	shouldRender = false
	canvasScale = 1.0
	canvasRotation = 0.0

	constructor(public app: App, public canvasElm: HTMLCanvasElement, public api: WebSocketApi) {
		this.factory = new OffscreenCanvasProxyFactory()
		this.canvasProxy = new WebCanvasProxy(this.canvasElm)
		const canvasModel = new ImageCanvasModel(this.canvasProxy.size)
		this.imageCanvas = new ImageCanvasDrawerWithPreview(canvasModel, this.factory)

		this.eventManager = new ImageCanvasEventManager()
		this.eventManager.event({
			id: '-1',
			userId: 'system',
			isRevoked: false,
			isVirtual: false,
			eventType: {
				kind: 'canvasInitialized',
				size: this.canvasProxy.size,
			},
		})

		this.eventManager.registerPlugin(new EventRenderer(this))

		this.undoManager = new ImageCanvasUndoManager(this.eventManager, this.factory, canvasModel)
		this.eventManager.registerPlugin(this.undoManager)

		this.revoker = new ImageCanvasEventRevoker(this.eventManager)

		this.layerManager = new LayerManager(this)
		this.penTool = new PenTool(this)

		this.renderLoop()
	}

	init(): void {
		const sender = new SocketCommandSender(this.app, this.eventManager, this.api)
		sender.start()

		this.commandSender = sender

		this.penTool.enable()
		this.activeTool = this.penTool

		this.app.canvasContainerElm.addEventListener('mousedown', (e) => {
			this.activeTool?.onMouseDown(this._getPosFromEvent(e))
		})

		this.app.canvasContainerElm.addEventListener('mousemove', (e) => {
			this.activeTool?.onMouseMoved(this._getPosFromEvent(e))
		})

		this.app.canvasContainerElm.addEventListener('mouseup', (e) => {
			this.activeTool?.onMouseUp(this._getPosFromEvent(e))
		})
	}

	private _getPosFromEvent(e: MouseEvent): Position {
		const rect = this.app.canvasContainerElm.getBoundingClientRect()

		// 中央を0とした座標に変換
		let x = e.clientX - rect.left - rect.width / 2
		let y = e.clientY - rect.top - rect.height / 2

		// 拡大率に合わせて座標変換
		x /= this.canvasScale
		y /= this.canvasScale

		// 角度に応じて座標変換
		const rot = -this.canvasRotation
		if (rot !== 0) {
			const nx = x * Math.cos(rot) - y * Math.sin(rot)
			const ny = x * Math.sin(rot) + y * Math.cos(rot)
			x = nx
			y = ny
		}

		// キャンバスの左上を0とした座標に変換
		const canvasSize = this.imageCanvas.model.size
		x += canvasSize.width / 2
		y += canvasSize.height / 2

		// はみ出し防止
		x = Math.max(0, Math.min(x, Math.floor(canvasSize.width)))
		y = Math.max(0, Math.min(y, Math.floor(canvasSize.height)))

		return { x, y }
	}

	undo(): void {
		if (this.app.userId === undefined) {
			return
		}

		const event = this.revoker.createUndoCommand(this.app.userId)
		if (event === undefined) {
			return
		}
		this.commandSender.command(event)
	}

	render(): void {
		this.shouldRender = true
	}

	renderLoop(): void {
		if (this.shouldRender) {
			this.imageCanvas.render(this.canvasProxy)
			this.shouldRender = false
		}

		window.requestAnimationFrame(() => {
			this.renderLoop()
		})
	}
}

async function deserializeLayerCanvasModel(
	data: SerializedLayerCanvasModel,
	factory: OffscreenCanvasProxyFactory
): Promise<LayerCanvasModel> {
	return new LayerCanvasModel(
		data.id,
		await factory.createCanvasProxyFromBitmap(data.image),
		data.name
	)
}

async function deserializeImageCanvasModel(
	data: SerializedImageCanvasModel,
	factory: OffscreenCanvasProxyFactory
): Promise<ImageCanvasModel> {
	const model = new ImageCanvasModel(data.size)
	const layers = await Promise.all(
		data.layers.map((x) => deserializeLayerCanvasModel(x, factory))
	)
	model.setLayers(layers, data.order)
	return model
}

type ChatMessageRecievedHandler = (userId: UserId, userName: string, message: string) => void
class ChatManager {
	private readonly _messageRecievedHandlers: ChatMessageRecievedHandler[] = []

	constructor(private readonly _api: WebSocketApi) {
		this._api.addEventHandler((event) => {
			if (event.kind === 'chatSent') {
				this._messageRecievedHandlers.forEach((x) =>
					x(event.userId, event.name, event.message)
				)
				return
			}
		})
	}

	addMessageRecievedHandler(handler: ChatMessageRecievedHandler) {
		this._messageRecievedHandlers.push(handler)
	}

	sendMessage(message: string) {
		this._api.sendCommand({ kind: 'sendChat', message })
	}
}

export class App {
	private _api: WebSocketApi
	private _paintApp: PaintApp | undefined
	private _userId: UserId | undefined
	private _chatManager: ChatManager | undefined
	readonly ready = new TypedEvent<void>()

	get paintApp(): PaintApp | undefined {
		return this._paintApp
	}

	get userId(): UserId | undefined {
		return this._userId
	}

	get chatManager(): ChatManager | undefined {
		return this._chatManager
	}

	constructor(
		readonly canvasContainerElm: HTMLDivElement,
		readonly canvasElm: HTMLCanvasElement,
		serverAddr: string,
		userName: string
	) {
		this._api = new WebSocketApi(serverAddr)

		this._api.addOpenHandler(() => {
			this._api.sendCommand({ kind: 'login', name: userName, reconnectionToken: undefined })

			const app = new PaintApp(this, canvasElm, this._api)
			this._paintApp = app
			app.init()
			app.render()

			this._api.sendCommand({ kind: 'requestData' })
			this._chatManager = new ChatManager(this._api)
			this.ready.emit()
		})

		this._api.addEventHandler((event) => {
			if (event.kind === 'loginAccepted') {
				this._userId = event.userId
				return
			}

			if (event.kind === 'userLoggedIn') {
				console.log(`${event.name} さん(id: ${event.userId})がログインしました`)
				return
			}

			if (event.kind === 'dataSent') {
				void (async () => {
					this._api.blockEvent()
					this._paintApp!.undoManager.setLastRenderedImageModel(
						await deserializeImageCanvasModel(event.value, this._paintApp!.factory)
					)
					this._paintApp!.eventManager.setHistory(event.log)
					this._api.resumeEvent()
				})()
				return
			}
		})

		this._api.start()
	}
}

export function main(
	container: HTMLDivElement,
	elm: HTMLCanvasElement,
	serverAddr: string,
	userName: string
): App {
	const app = new App(container, elm, serverAddr, userName)
	return app
}

Vue.use(VueRouter)
Vue.config.productionTip = false

const router = new VueRouter({
	routes: [
		{ path: '/', component: VueHome },
		{ path: '/room/:serverAddr/:userName', name: 'room', component: VueRoom, props: true },
	],
})

new Vue({
	router,
	render: (h) => h(VueIndex),
}).$mount('#app')
