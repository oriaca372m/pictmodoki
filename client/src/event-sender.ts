import { ImageCanvasCommand, ImageCanvasEventType, ImageCanvasEventManager } from './common'

export interface EventSender {
	command(cmd: ImageCanvasCommand): void
	event(event: ImageCanvasEventType): void
}

export class DebugEventSender implements EventSender {
	private _eventId = 0
	constructor(private _manager: ImageCanvasEventManager) {}

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'createLayer') {
			this._pushEvent({ kind: 'layerCreated', layerId: cmd.id })
		}
	}

	event(eventType: ImageCanvasEventType): void {
		this._pushEvent(eventType)
	}

	private _pushEvent(eventType: ImageCanvasEventType) {
		this._manager.event({
			id: 'virtual',
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: true,
			eventType,
		})

		setTimeout(() => {
			this._manager.event({
				id: this._eventId.toString(),
				userId: 'debugUser',
				isRevoked: false,
				isVirtual: false,
				eventType,
			})

			this._eventId++
		}, 1000)
	}
}
