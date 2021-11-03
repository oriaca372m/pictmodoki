import { Size } from 'common'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

export class DrawingRecorder {
	#ffmpeg: ChildProcessWithoutNullStreams

	constructor(outputPath: string, size: Size, framerate = 60) {
		this.#ffmpeg = spawn('ffmpeg', [
			'-y',
			'-f',
			'rawvideo',
			'-pixel_format',
			'bgra',
			'-video_size',
			`${size.width}x${size.height}`,
			'-framerate',
			`${framerate}`,
			'-i',
			'-',
			'-pix_fmt',
			'yuv420p',
			outputPath,
		])
	}

	addFrame(buffer: Buffer) {
		this.#ffmpeg.stdin.write(buffer)
	}

	async finish(): Promise<void> {
		return await new Promise<void>((resolve) => {
			this.#ffmpeg.on('close', () => {
				resolve()
			})

			this.#ffmpeg.stdin.end()
		})
	}
}
