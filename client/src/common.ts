import { Position, Size, Color } from './primitives'

export type LayerId = string
export type LayerDrawCommand =
	| { kind: 'stroke'; positions: Position[]; color: Color; width: number }
	| { kind: 'erase'; positions: Position[]; width: number }
	| { kind: 'clear' }

export interface LayerCanvas {
	readonly canvasProxy: CanvasProxy

	command(cmd: LayerDrawCommand): void
}

class LayerController {
	constructor(readonly id: LayerId, readonly layerCanvas: LayerCanvas, private _name: string) {}

	get name(): string {
		return this._name
	}
	setName(name: string): void {
		this._name = name
	}
}

export class NormalLayer implements LayerCanvas {
	private readonly _drawer: CanvasDrawer
	constructor(private readonly _canvasProxy: CanvasProxy) {
		this._drawer = new CanvasDrawer(_canvasProxy)
	}

	get canvasProxy(): CanvasProxy {
		return this._canvasProxy
	}

	command(cmd: LayerDrawCommand): void {
		if (cmd.kind === 'stroke') {
			this._drawer.stroke(cmd.positions, cmd.color, cmd.width)
		} else if (cmd.kind === 'erase') {
			this._drawer.erase(cmd.positions, cmd.width)
		} else if (cmd.kind === 'clear') {
			this._drawer.clear()
		}
	}
}

export interface CanvasProxy {
	getContext(): CanvasRenderingContext2D
	drawSelfTo(ctx: CanvasRenderingContext2D): void

	readonly size: Size
}

export interface CanvasProxyFactory {
	createCanvasProxy(size: Size): CanvasProxy
}

class CanvasDrawer {
	private _ctx!: CanvasRenderingContext2D

	constructor(private readonly _canvasProxy: CanvasProxy) {
		this._prepareContext()
	}

	private _prepareContext() {
		const ctx = this._canvasProxy.getContext()

		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'

		this._ctx = ctx
	}

	get canvasProxy(): CanvasProxy {
		return this._canvasProxy
	}

	stroke(positions: Position[], color: Color, width: number) {
		this._ctx.globalCompositeOperation = 'source-over'
		this._ctx.strokeStyle = color
		this._ctx.lineWidth = width

		this._stroke(positions)
	}

	erase(positions: Position[], width: number) {
		this._ctx.globalCompositeOperation = 'destination-out'
		this._ctx.strokeStyle = '#ffffff'
		this._ctx.lineWidth = width

		this._stroke(positions)
	}

	private _stroke(positions: Position[]) {
		this._ctx.beginPath()

		const { x, y } = positions[0]
		this._ctx.moveTo(x, y)

		for (let i = 1; i < positions.length; i++) {
			const { x, y } = positions[i]
			this._ctx.lineTo(x, y)
		}

		this._ctx.stroke()
	}

	clear() {
		const { width, height } = this._canvasProxy.size
		this._ctx.clearRect(0, 0, width, height)
	}

	drawCanvasProxy(canvas: CanvasProxy) {
		this._ctx.globalCompositeOperation = 'source-over'
		canvas.drawSelfTo(this._ctx)
	}
}

export type ImageCanvasCommand =
	| { kind: 'createLayer'; id: LayerId }
	| { kind: 'removeLayer'; layer: LayerId }
	| { kind: 'drawLayer'; layer: LayerId; drawCommand: LayerDrawCommand }

export class User {}

export class CommandHistory {
	push(cmd: ImageCanvasCommand, sender: User): void {}
}

export class ImageCanvas {
	private _layers: LayerController[] = []

	private _previewOriginalLayer: LayerController | undefined
	private _previewLayer: NormalLayer | undefined

	constructor(
		private readonly _size: Size,
		private readonly _canvasProxyFactory: CanvasProxyFactory
	) {}

	get layers(): readonly LayerController[] {
		return this._layers
	}

	private _createLayer(id: LayerId): LayerController {
		const foundLayer = this._layers.find((x) => x.id === id)
		if (foundLayer !== undefined) {
			return foundLayer
		}
		const canvas = this._canvasProxyFactory.createCanvasProxy(this._size)
		const layerCanvas = new NormalLayer(canvas)
		const controller = new LayerController(id, layerCanvas, '新規レイヤー')
		return controller
	}

	removeLayer(id: LayerId): void {
		this._layers = this._layers.filter((x) => x.id !== id)
	}

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'createLayer') {
			const layer = this._createLayer(cmd.id)
			this._layers.push(layer)
		}

		if (cmd.kind === 'drawLayer') {
			this._findLayerById(cmd.layer).layerCanvas.command(cmd.drawCommand)
		}
	}

	startPreview(layer: LayerId): void {
		if (this._previewOriginalLayer !== undefined && this._previewOriginalLayer.id === layer) {
			return
		}

		this._previewOriginalLayer = this._findLayerById(layer)

		const canvas = this._canvasProxyFactory.createCanvasProxy(this._size)
		this._previewLayer = new NormalLayer(canvas)
	}

	drawPreview(drawCmd: LayerDrawCommand): void {
		if (this._previewLayer === undefined) {
			throw new Error('startPreview() must be called before calling drawPreview().')
		}

		const drawer = new CanvasDrawer(this._previewLayer.canvasProxy)
		drawer.clear()
		drawer.drawCanvasProxy(this._previewOriginalLayer!.layerCanvas.canvasProxy)
		this._previewLayer.command(drawCmd)
	}

	endPreview(): void {
		this._previewOriginalLayer = undefined
		this._previewLayer = undefined
	}

	render(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()
		for (const layer of this._layers) {
			if (this._previewOriginalLayer && this._previewOriginalLayer.id === layer.id) {
				drawer.drawCanvasProxy(this._previewLayer!.canvasProxy)
			} else {
				drawer.drawCanvasProxy(layer.layerCanvas.canvasProxy)
			}
		}
	}

	private _findLayerById(id: LayerId): LayerController {
		return (
			this._layers.find((x) => x.id === id) ?? throwError(new Error('レイヤーが見つからない'))
		)
	}
}

function throwError(error: Error): never {
	throw error
}
