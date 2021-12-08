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

	stroke(positions: Position[], color: Color, width: number, curve: boolean): void {
		this._ctx.globalCompositeOperation = 'source-over'
		this._ctx.globalAlpha = 1
		this._ctx.strokeStyle = color
		this._ctx.lineWidth = width

		this._stroke(positions, curve)
	}

	erase(positions: Position[], alpha: number, width: number, curve: boolean): void {
		this._ctx.globalCompositeOperation = 'destination-out'
		this._ctx.globalAlpha = alpha
		this._ctx.strokeStyle = '#ffffff'
		this._ctx.lineWidth = width

		this._stroke(positions, curve)
	}

	private _stroke(positions: Position[], curve: boolean) {
		this._ctx.beginPath()

		if (curve) {
			this._strokeCurve(positions)
		} else {
			this._strokeNormal(positions)
		}

		this._ctx.stroke()
	}

	private _strokeNormal(positions: Position[]): void {
		const { x, y } = positions[0]
		this._ctx.moveTo(x, y)

		for (let i = 1; i < positions.length; i++) {
			const { x, y } = positions[i]
			this._ctx.lineTo(x, y)
		}
	}

	private _strokeCurve(positions: Position[]): void {
		this._ctx.moveTo(positions[0].x, positions[0].y)

		let i = 2
		for (; i < positions.length; i += 2) {
			const mid = positions[i - 1]
			const to = positions[i]
			this._ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y)
		}

		if (i == positions.length) {
			const p = positions[i - 1]
			this._ctx.lineTo(p.x, p.y)
		}
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
