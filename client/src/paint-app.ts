import { Position } from 'common'
import {
	ImageCanvasModel,
	ImageCanvasEvent,
	ImageCanvasEventRevoker,
	ImageCanvasEventExecutor,
} from 'common/dist/image-canvas'

import { CommandSender, SocketCommandSender } from './command-sender'
import { WebSocketApi } from './web-socket-api'
import { PenTool, EraserTool, MovingTool } from './paint-tool'
import { OffscreenCanvasProxyFactory, WebCanvasProxy } from './canvas-proxy'
import { LayerManager } from './layer-manager'
import { ImageCanvasDrawerWithPreview } from './image-canvas-drawer-with-preview'
import { VirtualEventManager } from './virtual-event-manager'
import { ToolManager } from './tool-manager'
import { App, AppState } from './app'
import { ColorHistory } from './color-history'
import { InputManager } from './input-manager'

export class PaintApp {
	readonly factory: OffscreenCanvasProxyFactory
	readonly drawer: ImageCanvasDrawerWithPreview
	private _renderedCanvas: WebCanvasProxy | undefined

	readonly inputManager: InputManager
	readonly commandSender: CommandSender
	readonly eventManager: VirtualEventManager
	eventExecutor: ImageCanvasEventExecutor
	readonly layerManager: LayerManager
	private readonly _revoker: ImageCanvasEventRevoker
	readonly toolManager: ToolManager

	readonly colorHistory = new ColorHistory()

	private _shouldRender = false
	private _canvasElm: HTMLCanvasElement | undefined

	constructor(public app: App, public api: WebSocketApi) {
		this.factory = new OffscreenCanvasProxyFactory()

		// 特に使用されないので小さめのサイズで作る
		const canvasModel = new ImageCanvasModel({ width: 256, height: 256 })
		this.drawer = new ImageCanvasDrawerWithPreview(canvasModel, this.factory)

		this.eventManager = new VirtualEventManager()

		this.eventExecutor = new ImageCanvasEventExecutor(
			this.eventManager,
			this.drawer,
			this.factory
		)
		this.eventManager.setExecutor(this.eventExecutor)
		this._revoker = new ImageCanvasEventRevoker(this.eventManager)

		this.layerManager = new LayerManager(this)

		this.inputManager = new InputManager(this)
		this.toolManager = new ToolManager(this)
		this.toolManager.registerTool('pen', new PenTool(this))
		this.toolManager.registerTool('eraser', new EraserTool(this))
		this.toolManager.registerTool('moving', new MovingTool(this))
		this.toolManager.selectTool('pen')

		const sender = new SocketCommandSender(this.app, this.eventManager, this.api)
		sender.start()
		this.commandSender = sender

		this.renderLoop()

		app.state.scale.valueChanged.on(() => {
			this._setCanvasStyle()
		})
		app.state.rotation.valueChanged.on(() => {
			this._setCanvasStyle()
		})

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

			if (e.key === 'z' && e.ctrlKey) {
				this.undo()
				e.preventDefault()
			}
		})

		window.addEventListener('keyup', (e) => {
			if (e.key === 'e' || e.key === ' ') {
				this.toolManager.popTool()
			}
		})
	}

	saveCanvas(): void {
		if (this._canvasElm !== undefined) {
			const link = document.createElement('a')
			link.href = this._canvasElm.toDataURL('image/png')
			link.download = 'canvas.png'
			link.click()
		}
	}

	setCanvasState(lastRendered: ImageCanvasModel, history: readonly ImageCanvasEvent[]): void {
		if (this.state.shouldSaveCanvas.value) {
			this.saveCanvas()
		}

		const canvasElm = document.createElement('canvas')
		canvasElm.width = lastRendered.size.width
		canvasElm.height = lastRendered.size.height

		this.app.canvasContainerElm.innerHTML = ''
		this.app.canvasContainerElm.appendChild(canvasElm)
		this._canvasElm = canvasElm
		this._setCanvasStyle()

		this._renderedCanvas = new WebCanvasProxy(canvasElm)

		this.drawer.setModel(lastRendered)
		this.eventExecutor = new ImageCanvasEventExecutor(
			this.eventManager,
			this.drawer,
			this.factory
		)
		this.eventManager.setExecutor(this.eventExecutor)

		try {
			this.eventManager.setRealHistory(Array.from(history))
		} catch (e) {
			console.error("Failed to set canavs's state: ", e)
			console.error(
				'これはバグです。上のエラーメッセージを付けて開発者に報告してください。https://github.com/oriaca372m/pictmodoki/issues'
			)
		}

		this.render()
		this.layerManager.update()
		this.layerManager.selectTopLayer()
		this.setCanvasViewEntire()
	}

	private _setCanvasStyle() {
		const canvasElm = this._canvasElm
		if (canvasElm === undefined) {
			return
		}

		const scale = this.app.state.scale.value
		const rot = this.app.state.rotation.value
		canvasElm.style.transform = `scale(${scale / 100}) rotate(${rot}deg)`
	}

	undo(): void {
		if (this.app.userId === undefined) {
			return
		}

		const event = this._revoker.createUndoCommand(this.app.userId)
		if (event === undefined) {
			return
		}
		this.commandSender.command(event)
	}

	setCanvasViewEntire(): void {
		const scrollElm = this.app.canvasScrollContainerElm
		const containerElm = this.app.canvasContainerElm

		const vw = scrollElm.clientWidth
		const vh = scrollElm.clientHeight
		const { width: cw, height: ch } = this.drawer.model.size

		const ratio = Math.floor(Math.min(vw / cw, vh / ch) * 100)
		this.app.state.scale.value = ratio
		this.app.state.rotation.value = 0

		scrollElm.scrollLeft = (containerElm.clientWidth - vw) / 2
		scrollElm.scrollTop = (containerElm.clientHeight - vh) / 2
	}

	setCanvasCenter(imagePos: Position) {
		const containerPos = this.inputManager.imagePosToContainerPos(imagePos)
		const scrollerElm = this.app.canvasScrollContainerElm
		scrollerElm.scrollLeft = containerPos.x - scrollerElm.clientWidth / 2
		scrollerElm.scrollTop = containerPos.y - scrollerElm.clientHeight / 2
	}

	get state(): AppState {
		return this.app.state
	}

	render(): void {
		this._shouldRender = true
	}

	renderLoop(): void {
		if (this._shouldRender) {
			if (this._renderedCanvas !== undefined) {
				this.drawer.render(this._renderedCanvas)
			}
			this._shouldRender = false
		}

		window.requestAnimationFrame(() => {
			this.renderLoop()
		})
	}
}
