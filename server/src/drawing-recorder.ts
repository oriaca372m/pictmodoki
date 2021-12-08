import { Size } from 'common'
import { Encoder } from 'encoder'

function round2(x: number): number {
	return Math.floor(x / 2) * 2
}

export class DrawingRecorder {
	#encoder: Encoder

	constructor(outputPath: string, readonly size: Size, framerate = 60) {
		this.#encoder = new Encoder(
			outputPath,
			size,
			{ width: round2(size.width / 2), height: round2(size.height / 2) },
			framerate
		)
		this.#encoder.init()
	}

	addFrame(buffer: Buffer) {
		this.#encoder.addBgra24Frame(buffer)
	}

	async finish(): Promise<void> {
		this.#encoder.finish()
		return Promise.resolve()
	}
}
