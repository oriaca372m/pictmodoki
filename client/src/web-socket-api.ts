import { encode, decodeAsync } from '@msgpack/msgpack'
import { Command, Event } from 'common'

export class WebSocketApi {
	private _socket!: WebSocket
	private readonly _eventHandlers: ((e: Event) => void)[] = []
	private readonly _openHandlers: (() => void)[] = []

	constructor(private readonly _addr: string) {}

	start(): void {
		this._socket = new WebSocket(this._addr)

		this._socket.addEventListener('open', () => {
			this._openHandlers.forEach((h) => {
				h()
			})
		})

		this._socket.addEventListener('message', (msg) => {
			this._onMessage(msg)
		})
	}

	get addr(): string {
		return this._addr
	}

	addEventHandler(h: (e: Event) => void): void {
		this._eventHandlers.push(h)
	}

	addOpenHandler(h: () => void): void {
		this._openHandlers.push(h)
	}

	private _onMessage(msg: MessageEvent<unknown>) {
		void (async () => {
			const blob = msg.data as Blob

			const event = (await decodeAsync(blob.stream())) as Event
			console.log(event)
			this._eventHandlers.forEach((h) => {
				h(event)
			})
		})()
	}

	sendCommand(cmd: Command): void {
		this._socket.send(encode(cmd))
	}
}
