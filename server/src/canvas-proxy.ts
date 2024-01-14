import { CanvasProxy, CanvasProxyFactory, Size } from 'common'

import * as fs from 'fs'
import { createCanvas, Canvas } from 'canvas'

export class NodeCanvasProxy implements CanvasProxy {
	private readonly _canvas: Canvas
	constructor(size: Size) {
		this._canvas = createCanvas(size.height, size.width)
	}

	getContext(): CanvasRenderingContext2D {
		return this._canvas.getContext('2d') as unknown as CanvasRenderingContext2D
	}

	drawSelfTo(ctx: CanvasRenderingContext2D): void {
		ctx.drawImage(this._canvas as unknown as CanvasImageSource, 0, 0)
	}

	get size(): Size {
		return { width: this._canvas.width, height: this._canvas.height }
	}

	serialize(): Promise<Uint8Array> {
		const buf = this._canvas.toBuffer()
		return Promise.resolve(new Uint8Array(buf))
	}

	saveFile(path: string): void {
		const out = fs.createWriteStream(path)
		const stream = this._canvas.createPNGStream()
		stream.pipe(out)
	}

	toRawBuffer(): Buffer {
		return this._canvas.toBuffer('raw')
	}
}

export class NodeCanvasProxyFactory implements CanvasProxyFactory {
	createCanvasProxy(size: Size): NodeCanvasProxy {
		return new NodeCanvasProxy(size)
	}
}
