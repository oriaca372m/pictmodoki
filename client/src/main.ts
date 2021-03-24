import {
	CanvasProxy,
	CanvasProxyFactory,
	ImageCanvasModel,
	ImageCanvasDrawer,
	LayerDrawCommand,
	Size,
	Position,
	Color,
	ImageCanvasEvent,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasEventPlayer,
	ImageCanvasUndoManager,
} from 'common'

import { CommandSender, SocketCommandSender } from './event-sender'

import { encode } from '@msgpack/msgpack'

import Vue from 'vue'
import VueIndex from './views/index.vue'

class OffscreenCanvasProxy implements CanvasProxy {
	constructor(private readonly _canvas: OffscreenCanvas) {}

	getContext(): CanvasRenderingContext2D {
		const ctx = this._canvas.getContext('2d')

		if (ctx === null) {
			throw new Error('Could not get a context of the OffscreenCanvas.')
		}

		return (ctx as unknown) as CanvasRenderingContext2D
	}

	drawSelfTo(ctx: CanvasRenderingContext2D): void {
		ctx.drawImage(this._canvas, 0, 0)
	}

	async serialize(): Promise<Uint8Array> {
		const blob = await this._canvas.convertToBlob()
		const arrayBuffer = await blob.arrayBuffer()
		return new Uint8Array(arrayBuffer)
	}

	get size(): Size {
		return { width: this._canvas.width, height: this._canvas.height }
	}
}

export class OffscreenCanvasProxyFactory implements CanvasProxyFactory {
	createCanvasProxy(size: Size): CanvasProxy {
		const canvas = new OffscreenCanvas(size.width, size.height)
		return new OffscreenCanvasProxy(canvas)
	}

	async createCanvasProxyFromBitmap(data: Uint8Array): Promise<CanvasProxy> {
		const image = await createImageBitmap(new Blob([data]))
		const canvas = new OffscreenCanvas(image.width, image.height)
		const renderer = canvas.getContext('2d')
		renderer?.drawImage(image, 0, 0)
		return new OffscreenCanvasProxy(canvas)
	}
}

class WebCanvasProxy implements CanvasProxy {
	constructor(private readonly _canvas: HTMLCanvasElement) {}

	getContext(): CanvasRenderingContext2D {
		const ctx = this._canvas.getContext('2d')

		if (ctx === null) {
			throw new Error('Could not get a context of the Canvas.')
		}
		return (ctx as unknown) as CanvasRenderingContext2D
	}

	drawSelfTo(ctx: CanvasRenderingContext2D): void {
		ctx.drawImage(this._canvas, 0, 0)
	}

	async serialize(): Promise<Uint8Array> {
		return new Promise((resolve, reject) => {
			this._canvas.toBlob((blob) => {
				if (blob === null) {
					reject()
					return
				}

				blob.arrayBuffer()
					.then((x) => resolve(new Uint8Array(x)))
					.catch((x) => reject(x))
			})
		})
	}

	get size(): Size {
		return { width: this._canvas.width, height: this._canvas.height }
	}
}

interface Tool {
	enable(): void
	disable(): void

	readonly isEnabled: boolean
}

class PenTool implements Tool {
	private _pathPositions: Position[] | undefined
	color: Color = '#ff0000'
	width = 10
	mode: 'stroke' | 'erase' = 'stroke'
	private readonly _imageCanvas: ImageCanvasDrawer
	private readonly _canvasElm: HTMLCanvasElement

	private _isEnabled = false

	constructor(private readonly _app: App) {
		this._imageCanvas = _app.imageCanvas
		this._canvasElm = _app.canvasElm

		this._canvasElm.addEventListener('mousedown', (e) => {
			if (!this._isEnabled) {
				return
			}
			this._startStroke(this._getPosFromEvent(e))
		})

		this._canvasElm.addEventListener('mousemove', (e) => {
			if (!this._isEnabled) {
				return
			}
			this._continueStroke(this._getPosFromEvent(e))
		})

		this._canvasElm.addEventListener('mouseup', () => {
			if (!this._isEnabled) {
				return
			}
			this._finishStroke()
		})
	}

	enable() {
		this._isEnabled = true
	}

	disable() {
		this._finishStroke()
		this._isEnabled = false
	}

	get isEnabled(): boolean {
		return this._isEnabled
	}

	private _startStroke(pos: Position) {
		if (this._pathPositions !== undefined) {
			return
		}

		this._pathPositions = [pos]
		this._imageCanvas.startPreview(this._app.selectedLayerId)
	}

	private _continueStroke({ x, y }: Position) {
		if (this._pathPositions === undefined) {
			return
		}

		const lastPosition = this._pathPositions[this._pathPositions.length - 1]
		if (lastPosition.x === x && lastPosition.y === y) {
			return
		}

		this._pathPositions.push({ x, y })
		this._imageCanvas.drawPreview(this._constructCommand())
		this._app.render()
	}

	private _finishStroke() {
		if (this._pathPositions === undefined) {
			return
		}

		this._imageCanvas.endPreview()
		this._app.render()

		this._app.commandSender.command({
			kind: 'drawLayer',
			layer: this._app.selectedLayerId,
			drawCommand: this._constructCommand(),
		})

		this._pathPositions = undefined
	}

	private _getPosFromEvent(e: MouseEvent): Position {
		const rect = this._canvasElm.getBoundingClientRect()
		const x = e.clientX - rect.left
		const y = e.clientY - rect.top

		return { x, y }
	}

	private _constructCommand(): LayerDrawCommand {
		return {
			kind: this.mode,
			positions: this._pathPositions!,
			color: this.color,
			width: this.width,
		}
	}
}

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
	selectedLayerId = 'default'
	commandSender!: CommandSender
	eventManager: ImageCanvasEventManager
	undoManager: ImageCanvasUndoManager
	factory: OffscreenCanvasProxyFactory

	constructor(public canvasElm: HTMLCanvasElement, public socket: WebSocket) {
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

		this.undoManager = new ImageCanvasUndoManager(
			'debugUser',
			this.eventManager,
			this.factory,
			canvasModel
		)
		this.eventManager.registerPlugin(this.undoManager)

		this.penTool = new PenTool(this)
	}

	init(): void {
		const sender = new SocketCommandSender(this, this.eventManager, this.socket)
		sender.start()

		this.commandSender = sender

		this.penTool.enable()
	}

	undo(): void {
		const event = this.undoManager.createUndoCommand()
		if (event === undefined) {
			return
		}
		this.commandSender.command(event)
	}

	render(): void {
		this.imageCanvas.render(this.canvasProxy)
	}
}

export function main(elm: HTMLCanvasElement): App {
	const sock = new WebSocket('ws://127.0.0.1:5001')
	const app = new App(elm, sock)

	sock.onopen = () => {
		console.log('started')
		app.init()
		app.render()

		sock.send(encode({ kind: 'requestData' }))
	}

	return app
}

Vue.config.productionTip = false

new Vue({
	render: (h) => h(VueIndex),
}).$mount('#app')
