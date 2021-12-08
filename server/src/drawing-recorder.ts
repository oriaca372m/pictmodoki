import { Size } from 'common'
import { Encoder } from 'encoder'

export class DrawingRecorder {
	#encoder: Encoder

	constructor(outputPath: string, readonly size: Size, framerate = 60) {
		this.#encoder = new Encoder(outputPath, size, size, framerate)
		this.#encoder.init()
	}

	addFrame(buffer: Buffer) {
		this.#encoder.addFrame(buffer)
	}

	async finish(): Promise<void> {
		this.#encoder.finish()
		return Promise.resolve()
	}
}
