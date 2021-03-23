import {
	CanvasProxy,
	CanvasProxyFactory,
	ImageCanvasModel,
	ImageCanvasDrawer,
	LayerDrawCommand,
	Size,
	Position,
	Color,
} from './common'

import Vue from 'vue'
import VueIndex from './views/index.vue'

class OffscreenCanvasProxy implements CanvasProxy {
	private readonly _canvas: OffscreenCanvas

	constructor(private readonly _size: Size) {
		this._canvas = new OffscreenCanvas(_size.width, _size.height)
	}

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

	get size(): Size {
		return this._size
	}
}

class OffscreenCanvasProxyFactory implements CanvasProxyFactory {
	createCanvasProxy(size: Size): CanvasProxy {
		return new OffscreenCanvasProxy(size)
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
		this._imageCanvas.command({
			kind: 'drawLayer',
			layer: this._app.selectedLayerId,
			drawCommand: this._constructCommand(),
		})
		this._app.render()

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

class App {
	canvasProxy: WebCanvasProxy
	imageCanvas: ImageCanvasDrawer
	penTool: PenTool
	selectedLayerId = 'default'

	constructor(public canvasElm: HTMLCanvasElement) {
		this.canvasProxy = new WebCanvasProxy(this.canvasElm)
		const canvasModel = new ImageCanvasModel(this.canvasProxy.size)
		this.imageCanvas = new ImageCanvasDrawer(canvasModel, new OffscreenCanvasProxyFactory())

		this.penTool = new PenTool(this)
	}

	init(): void {
		this.imageCanvas.command({
			kind: 'createLayer',
			id: 'default',
		})

		this.imageCanvas.command({
			kind: 'createLayer',
			id: 'top-default',
		})

		this.penTool.enable()
	}

	render(): void {
		this.imageCanvas.render(this.canvasProxy)
	}
}

export function main(elm: HTMLCanvasElement): App {
	const app = new App(elm)

	app.init()
	app.render()

	return app
}

Vue.config.productionTip = false

new Vue({
	render: (h) => h(VueIndex),
}).$mount('#app')
