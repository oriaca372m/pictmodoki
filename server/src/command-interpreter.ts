import {
	ImageCanvasEvent,
	ImageCanvasEventType,
	ImageCanvasCommand,
	ImageCanvasDrawer,
	ImageCanvasEventManager,
	ImageCanvasEventRevoker,
	ImageCanvasCommandValidator,
	UserId,
} from 'common'

export class CommandInterpreter {
	private _eventId = 0
	private _layerId = 0
	private readonly _revoker: ImageCanvasEventRevoker
	private readonly _validator: ImageCanvasCommandValidator

	constructor(
		private readonly _drawer: ImageCanvasDrawer,
		private readonly _manager: ImageCanvasEventManager
	) {
		this._revoker = new ImageCanvasEventRevoker(this._manager)
		this._validator = new ImageCanvasCommandValidator(_drawer, this._revoker)
	}

	command(userId: UserId, cmd: ImageCanvasCommand): ImageCanvasEvent | undefined {
		if (!this._validator.validate(userId, cmd)) {
			return
		}

		if (cmd.kind === 'drawLayer') {
			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerDrawn',
					layerId: cmd.layer,
					drawCommand: cmd.drawCommand,
				})
			)
		} else if (cmd.kind === 'createLayer') {
			const event = this._genEvent(userId, {
				kind: 'layerCreated',
				layerId: this._layerId.toString(),
			})
			this._pushEvent(event)
			this._layerId++
			return event
		} else if (cmd.kind === 'removeLayer') {
			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerRemoved',
					layerId: cmd.layer,
				})
			)
		} else if (cmd.kind === 'revokeEvent') {
			return this._pushEvent(
				this._genEvent(userId, { kind: 'eventRevoked', eventId: cmd.eventId })
			)
		} else if (cmd.kind === 'setLayerOrder') {
			return this._pushEvent(
				this._genEvent(userId, {
					kind: 'layerOrderChanged',
					order: cmd.order,
				})
			)
		}
	}

	private _genEvent(userId: UserId, eventType: ImageCanvasEventType): ImageCanvasEvent {
		return {
			id: this._eventId.toString(),
			userId,
			isRevoked: false,
			isVirtual: false,
			eventType,
		}
	}

	private _pushEvent(event: ImageCanvasEvent): ImageCanvasEvent {
		this._manager.event(event)
		this._eventId++
		return event
	}
}
