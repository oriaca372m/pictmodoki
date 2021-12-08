import { Size } from 'common'
import { Encoder } from 'encoder'
import { resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'

function round2(x: number): number {
	return Math.floor(x / 2) * 2
}

export class DrawingRecorder {
	#encoder: Encoder | undefined
	#id: string
	#outSize: Size

	get id(): string {
		return this.#id
	}

	get outputPath(): string {
		return resolve(this.outputDir, this.#id + '.mp4')
	}

	constructor(readonly outputDir: string, readonly size: Size, readonly framerate = 60) {
		this.#id = uuidv4()
		this.#outSize = { width: round2(size.width / 2), height: round2(size.height / 2) }
	}

	addFrame(buffer: Buffer) {
		if (this.#encoder === undefined) {
			this.#encoder = new Encoder(this.outputPath, this.size, this.#outSize, this.framerate)
			this.#encoder.init()
		}
		this.#encoder.addBgra24Frame(buffer)
	}

	// 実際に映像が出力されたらtrue
	finish(): boolean {
		if (this.#encoder !== undefined) {
			this.#encoder.finish()
			return true
		}
		return false
	}
}
