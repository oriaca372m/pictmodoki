import { Bindable } from './bindable'

export class AudioPlayer {
	private readonly _audioCtx = new AudioContext()
	private readonly _gainNode: GainNode
	private readonly _cache = new Map<string, Promise<AudioBuffer>>()

	readonly volume = new Bindable(30)

	constructor() {
		this._gainNode = this._audioCtx.createGain()
		this._gainNode.connect(this._audioCtx.destination)

		this.volume.valueChanged.on(() => {
			this._gainNode.gain.value = this.volume.value / 100
		}, true)
	}

	playAudio(path: string): void {
		if (!this._cache.has(path)) {
			this._cache.set(path, this._fetchAudio(path))
		}

		void (async () => {
			const buffer = await this._cache.get(path)!
			const node = new AudioBufferSourceNode(this._audioCtx, { buffer })
			node.connect(this._gainNode)
			node.start()
		})()
	}

	private async _fetchAudio(path: string): Promise<AudioBuffer> {
		const data = await fetch(path)
		return this._audioCtx.decodeAudioData(await data.arrayBuffer())
	}
}
