import { ImageCanvasCommand, ImageCanvasEventType, ImageCanvasEventManager } from 'common'

export interface CommandSender {
	command(cmd: ImageCanvasCommand): void
}

export class DebugCommandSender implements CommandSender {
	private _eventId = 0
	private _layerId = 0
	constructor(private _manager: ImageCanvasEventManager) {}

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

	event(eventType: ImageCanvasEventType): void {
		this._pushEvent(eventType)
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
