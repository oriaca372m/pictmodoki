import { CanvasProxy, CanvasProxyFactory, Size } from 'common'

export class OffscreenCanvasProxy implements CanvasProxy {
	constructor(private readonly _canvas: OffscreenCanvas) {}

	getContext(): CanvasRenderingContext2D {
		const ctx = this._canvas.getContext('2d')

		if (ctx === null) {
			throw new Error('Could not get a context of the OffscreenCanvas.')
		}

		return ctx as unknown as CanvasRenderingContext2D
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

export class WebCanvasProxy implements CanvasProxy {
	constructor(private readonly _canvas: HTMLCanvasElement) {}

	getContext(): CanvasRenderingContext2D {
		const ctx = this._canvas.getContext('2d')

		if (ctx === null) {
			throw new Error('Could not get a context of the Canvas.')
		}
		return ctx as unknown as CanvasRenderingContext2D
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
