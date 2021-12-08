import { Size } from 'common'
import { Encoder } from 'encoder'
import { resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'

function round2(x: number): number {
	return Math.floor(x / 2) * 2
}

export class DrawingRecorder {
	#encoder: Encoder
	#id: string

	get id(): string {
		return this.#id
	}

	get outputPath(): string {
		return resolve(this.outputDir, this.#id + '.mp4')
	}

	constructor(readonly outputDir: string, readonly size: Size, framerate = 60) {
		this.#id = uuidv4()
		this.#encoder = new Encoder(
			this.outputPath,
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
