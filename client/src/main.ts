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
	LayerId,
	ImageCanvasEventRevoker,
} from 'common'

import { CommandSender, SocketCommandSender } from './event-sender'
import { WebSocketApi } from './web-socket-api'
import { PenTool } from './paint-tool'
import { OffscreenCanvasProxyFactory, WebCanvasProxy } from './canvas-proxy'

import Vue from 'vue'
import VueIndex from './views/index.vue'

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
		this._app.render()
	}

	onHistoryChanged(): void {
		const model = this._app.undoManager.createUndoedImageCanvasModel()
		this._app.imageCanvas.setModel(model)
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
	selectedLayerId: LayerId | undefined
	commandSender!: CommandSender
	eventManager: ImageCanvasEventManager
	undoManager: ImageCanvasUndoManager
	factory: OffscreenCanvasProxyFactory
	revoker: ImageCanvasEventRevoker

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

		this.penTool = new PenTool(this)
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
		this.imageCanvas.render(this.canvasProxy)
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

export function main(elm: HTMLCanvasElement): App {
	const api = new WebSocketApi('ws://127.0.0.1:5001')
	const userId = window.prompt('USER ID?') ?? 'default'
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

Vue.config.productionTip = false

new Vue({
	render: (h) => h(VueIndex),
}).$mount('#app')
