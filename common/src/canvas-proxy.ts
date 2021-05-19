import { Size, Position, Color } from './primitives'

export interface CanvasProxy {
	getContext(): CanvasRenderingContext2D
	drawSelfTo(ctx: CanvasRenderingContext2D): void

	serialize(): Promise<Uint8Array>
	readonly size: Size
}

export interface CanvasProxyFactory {
	createCanvasProxy(size: Size): CanvasProxy
}

export class CanvasDrawer {
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

	stroke(positions: Position[], color: Color, width: number): void {
		this._ctx.globalCompositeOperation = 'source-over'
		this._ctx.globalAlpha = 1
		this._ctx.strokeStyle = color
		this._ctx.lineWidth = width

		this._stroke(positions)
	}

	erase(positions: Position[], alpha: number, width: number): void {
		this._ctx.globalCompositeOperation = 'destination-out'
		this._ctx.globalAlpha = alpha
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

	clear(): void {
		const { width, height } = this._canvasProxy.size
		this._ctx.globalCompositeOperation = 'source-over'
		this._ctx.globalAlpha = 1
		this._ctx.clearRect(0, 0, width, height)
	}

	drawCanvasProxy(canvas: CanvasProxy): void {
		this._ctx.globalCompositeOperation = 'source-over'
		this._ctx.globalAlpha = 1
		canvas.drawSelfTo(this._ctx)
	}
}
