import {
	ImageCanvasCommand,
	ImageCanvasEvent,
	ImageCanvasEventType,
	ImageCanvasEventManager,
} from 'common'

export interface CommandSender {
	command(cmd: ImageCanvasCommand): void
}

export class SocketCommandSender implements CommandSender {
	constructor(private _manager: ImageCanvasEventManager, private _socket: WebSocket) {}

	start(): void {
		this._socket.onmessage = (msg) => {
			console.log(msg.data)
			const event = JSON.parse(msg.data) as ImageCanvasEvent
			this._manager.event(event)
		}
	}

	command(cmd: ImageCanvasCommand): void {
		this._socket.send(JSON.stringify(cmd))
		this._pushVirtualEvent(cmd)
	}

	private _pushVirtualEvent(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(eventType: ImageCanvasEventType) {
		this._manager.event({
			id: 'virtual',
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: true,
			eventType,
		})
	}
}

export class DebugCommandSender implements CommandSender {
	private _eventId = 0
	private _layerId = 0
	constructor(private _manager: ImageCanvasEventManager, private _socket: WebSocket) {}

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'createLayer') {
			this._pushEvent({ kind: 'layerCreated', layerId: this._layerId.toString() }, false)
			this._layerId++
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(eventType: ImageCanvasEventType, sendVirtualEvent = true) {
		if (sendVirtualEvent) {
			this._manager.event({
				id: 'virtual',
				userId: 'debugUser',
				isRevoked: false,
				isVirtual: true,
				eventType,
			})
		}

		const event = {
			id: this._eventId.toString(),
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: false,
			eventType,
		}
		this._eventId++

		setTimeout(() => {
			this._manager.event(event)
		}, 1000)
	}
}
