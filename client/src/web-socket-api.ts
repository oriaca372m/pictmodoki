import { encode, decodeAsync } from '@msgpack/msgpack'
import { Command, Event } from 'common'
import { TypedEvent } from './typed-event'

export class WebSocketApi {
	private _socket!: WebSocket

	readonly eventHappened = new TypedEvent<Event>()
	readonly opened = new TypedEvent<void>()

	constructor(private readonly _addr: string) {}

	start(): void {
		this._socket = new WebSocket(this._addr)

		this._socket.addEventListener('open', () => {
			this.opened.emit()
		})

		this._socket.addEventListener('message', (msg) => {
			this._onMessage(msg)
		})
	}

	get addr(): string {
		return this._addr
	}

	private _onMessage(msg: MessageEvent<unknown>) {
		void (async () => {
			const blob = msg.data as Blob
			// TODO: デコードにかかる時間によっては到着順が保証されなくなる?
			const event = (await decodeAsync(blob.stream())) as Event
			console.log(event)

			this.eventHappened.emit(event)
		})()
	}

	sendCommand(cmd: Command): void {
		this._socket.send(encode(cmd))
	}

	blockEvent(): void {
		// TODO: イベントハンドラにデータが流れないようにする
		// その間に来たデータはキューにためておく
	}
	resumeEvent(): void {
		// TODO: blockEventの効果を解除する
		// キューは消費する
	}
}
