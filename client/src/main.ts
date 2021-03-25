import {
	ImageCanvasModel,
	SerializedImageCanvasModel,
	ImageCanvasDrawer,
	ImageCanvasEvent,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasEventPlayer,
	ImageCanvasUndoManager,
	LayerCanvasModel,
	SerializedLayerCanvasModel,
	ImageCanvasEventRevoker,
} from 'common'

import { CommandSender, SocketCommandSender } from './event-sender'
import { WebSocketApi } from './web-socket-api'
import { PenTool } from './paint-tool'
import { OffscreenCanvasProxyFactory, WebCanvasProxy } from './canvas-proxy'
import { LayerManager } from './layer-manager'

import Vue from 'vue'
import VueRouter from 'vue-router'
import VueIndex from './views/index.vue'
import VueHome from './views/home.vue'
import VueRoom from './views/room.vue'

class EventRenderer implements ImageCanvasEventManagerPlugin {
	private readonly _player: ImageCanvasEventPlayer
	constructor(private readonly _app: App) {
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

export class App {
	canvasProxy: WebCanvasProxy
	imageCanvas: ImageCanvasDrawer
	penTool: PenTool
	commandSender!: CommandSender
	eventManager: ImageCanvasEventManager
	undoManager: ImageCanvasUndoManager
	factory: OffscreenCanvasProxyFactory
	revoker: ImageCanvasEventRevoker
	layerManager: LayerManager
	shouldRender = false

	constructor(
		public canvasElm: HTMLCanvasElement,
		public api: WebSocketApi,
		public userId: string
	) {
		this.factory = new OffscreenCanvasProxyFactory()
		this.canvasProxy = new WebCanvasProxy(this.canvasElm)
		const canvasModel = new ImageCanvasModel(this.canvasProxy.size)
		this.imageCanvas = new ImageCanvasDrawer(canvasModel, this.factory)

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
		const sender = new SocketCommandSender(this, this.eventManager, this.api)
		sender.start()

		this.commandSender = sender

		this.penTool.enable()
	}

	undo(): void {
		const event = this.revoker.createUndoCommand(this.userId)
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
	model.layers = layers
	return model
}

export function main(elm: HTMLCanvasElement, serverAddr: string, userId: string): App {
	const api = new WebSocketApi(serverAddr)
	const app = new App(elm, api, userId)

	api.addOpenHandler(() => {
		api.sendCommand({ kind: 'setUserId', value: app.userId })

		console.log('started')
		app.init()
		app.render()

		api.sendCommand({ kind: 'requestData' })
	})

	api.addEventHandler((event) => {
		if (event.kind !== 'dataSent') {
			return
		}

		void (async () => {
			api.blockEvent()
			app.undoManager.setLastRenderedImageModel(
				await deserializeImageCanvasModel(event.value, app.factory)
			)
			app.eventManager.setHistory(event.log)
			api.resumeEvent()
		})()
	})

	api.start()
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
