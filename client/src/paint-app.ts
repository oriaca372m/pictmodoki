import {
	ImageCanvasModel,
	ImageCanvasEvent,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasEventPlayer,
	ImageCanvasUndoManager,
	ImageCanvasEventRevoker,
} from 'common'

import { CommandSender, SocketCommandSender } from './event-sender'
import { WebSocketApi } from './web-socket-api'
import { PenTool, EraserTool, MovingTool } from './paint-tool'
import { OffscreenCanvasProxyFactory, WebCanvasProxy } from './canvas-proxy'
import { LayerManager } from './layer-manager'
import { ImageCanvasDrawerWithPreview } from './image-canvas-drawer-with-preview'
import { ToolManager } from './tool-manager'
import { App } from './app'

class EventRenderer implements ImageCanvasEventManagerPlugin {
	private readonly _player: ImageCanvasEventPlayer
	constructor(private readonly _app: PaintApp) {
		this._player = new ImageCanvasEventPlayer(_app.drawer)
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
		this._app.drawer.setModel(model)
		this._app.layerManager.update()
		this._app.render()
	}

	onHistoryWiped(): void {
		// pass
	}
}

export class PaintApp {
	factory: OffscreenCanvasProxyFactory
	drawer: ImageCanvasDrawerWithPreview
	private _renderedCanvas: WebCanvasProxy

	commandSender!: CommandSender
	eventManager: ImageCanvasEventManager
	undoManager: ImageCanvasUndoManager
	revoker: ImageCanvasEventRevoker
	layerManager: LayerManager

	readonly toolManager: ToolManager
	readonly penTool: PenTool
	readonly eraserTool: EraserTool

	canvasScale = 1.0
	canvasRotation = 0.0

	private _shouldRender = false

	constructor(public app: App, public canvasElm: HTMLCanvasElement, public api: WebSocketApi) {
		this.factory = new OffscreenCanvasProxyFactory()
		this._renderedCanvas = new WebCanvasProxy(this.canvasElm)
		const canvasModel = new ImageCanvasModel(this._renderedCanvas.size)
		this.drawer = new ImageCanvasDrawerWithPreview(canvasModel, this.factory)

		this.eventManager = new ImageCanvasEventManager()
		this.eventManager.event({
			id: '-1',
			userId: 'system',
			isRevoked: false,
			isVirtual: false,
			eventType: {
				kind: 'canvasInitialized',
				size: this._renderedCanvas.size,
			},
		})

		this.eventManager.registerPlugin(new EventRenderer(this))

		this.undoManager = new ImageCanvasUndoManager(this.eventManager, this.factory, canvasModel)
		this.eventManager.registerPlugin(this.undoManager)

		this.revoker = new ImageCanvasEventRevoker(this.eventManager)

		this.layerManager = new LayerManager(this)

		this.penTool = new PenTool(this)
		this.eraserTool = new EraserTool(this)
		this.toolManager = new ToolManager(this, this.app.canvasContainerElm)
		this.toolManager.registerTool('pen', this.penTool)
		this.toolManager.registerTool('eraser', this.eraserTool)
		this.toolManager.registerTool('moving', new MovingTool(this.app))

		this.renderLoop()

		// TODO: 整理
		window.addEventListener('keydown', (e) => {
			// スペースキーでのスクロールを防ぐ
			if (e.key === ' ') {
				e.preventDefault()
			}

			if (e.repeat) {
				return
			}

			if (e.key === 'e') {
				this.toolManager.pushTool('eraser')
			}

			if (e.key === ' ') {
				this.toolManager.pushTool('moving')
			}
		})

		window.addEventListener('keyup', (e) => {
			if (e.key === 'e' || e.key === ' ') {
				this.toolManager.popTool()
			}
		})
	}

	init(): void {
		const sender = new SocketCommandSender(this.app, this.eventManager, this.api)
		sender.start()

		this.commandSender = sender
		this.toolManager.selectTool('pen')
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
		this._shouldRender = true
	}

	renderLoop(): void {
		if (this._shouldRender) {
			this.drawer.render(this._renderedCanvas)
			this._shouldRender = false
		}

		window.requestAnimationFrame(() => {
			this.renderLoop()
		})
	}
}
