import { UserId } from '../user.js'
import { ImageCanvasCommand } from './command.js'
import { ImageCanvasEventType, ImageCanvasEventId } from './event.js'
import { ImageCanvasEventManager } from './event-manager.js'

export class ImageCanvasEventRevoker {
	static readonly unrevokableEvents: ImageCanvasEventType['kind'][] = ['eventRevoked']

	constructor(private readonly _eventManager: ImageCanvasEventManager) {}

	isRevokable(userId: UserId, eventId: ImageCanvasEventId): boolean {
		const event = this._eventManager.realHistory.find((x) => x.id === eventId)
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

	createUndoCommand(userId: UserId): ImageCanvasCommand | undefined {
		const event = Array.from(this._eventManager.realHistory)
			.reverse()
			.find((x) => x.eventType.kind !== 'eventRevoked' && x.userId === userId && !x.isRevoked)
		if (event === undefined || !this.isRevokable(userId, event.id)) {
			return
		}

		return { kind: 'revokeEvent', eventId: event.id }
	}
}
