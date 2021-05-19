import { UserId } from '../user'
import { ImageCanvasCommand } from './command'
import { ImageCanvasEventType, ImageCanvasEventId } from './event'
import { ImageCanvasEventManager } from './event-manager'

export class ImageCanvasEventRevoker {
	static readonly unrevokableEvents: ImageCanvasEventType['kind'][] = [
		'eventRevoked',
		'layerCreated',
	]

	constructor(private readonly _eventManager: ImageCanvasEventManager) {}

	isRevokable(userId: UserId, eventId: ImageCanvasEventId): boolean {
		const event = this._eventManager.mergedHistory.find((x) => x.id === eventId)
		if (event === undefined) {
			return false
		}

		if (event.userId !== userId) {
			return false
		}

		if (event.isRevoked) {
			return false
		}

		if (ImageCanvasEventRevoker.unrevokableEvents.includes(event.eventType.kind)) {
			return false
		}

		return true
	}

	private _canCreateUndoCommand(): boolean {
		return true
	}

	createUndoCommand(userId: UserId): ImageCanvasCommand | undefined {
		if (!this._canCreateUndoCommand()) {
			return
		}
		const event = Array.from(this._eventManager.realHistory)
			.reverse()
			.find((x) => x.eventType.kind !== 'eventRevoked' && x.userId === userId && !x.isRevoked)
		if (event === undefined || !this.isRevokable(userId, event.id)) {
			return
		}

		return { kind: 'revokeEvent', eventId: event.id }
	}
}
