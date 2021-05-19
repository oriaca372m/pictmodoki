import { ImageCanvasEvent } from './event'
import lodash from 'lodash'

import { ImageCanvasEventExecutor } from './event-executor'

// Revoker用
import { UserId } from '../user'
import { ImageCanvasCommand } from './command'
import { ImageCanvasEventType, ImageCanvasEventId } from './event'

export class ImageCanvasEventManager {
	private _history: ImageCanvasEvent[] = []
	private readonly _numEventsToPreserve = 50
	private _executor!: ImageCanvasEventExecutor

	get executor(): ImageCanvasEventExecutor {
		return this._executor
	}

	setExecutor(executor: ImageCanvasEventExecutor): void {
		this._executor = executor
	}

	get realHistory(): readonly ImageCanvasEvent[] {
		return this._history
	}

	breakHistory(): void {
		this._history = []
	}

	protected _wipeHistoryIfnecessary(): void {
		const numToWipe = this._history.length - this._numEventsToPreserve
		if (numToWipe < 1) {
			return
		}

		const wiped = this._history.splice(0, numToWipe)
		this._executor.applyWipedEvents(wiped)
	}

	event(event: ImageCanvasEvent): boolean {
		if (!this._executor.executeEvent(event)) {
			return false
		}

		this._determineEvent(event)
		return true
	}

	protected _determineEvent(event: ImageCanvasEvent): void {
		this._history.push(event)
		this._wipeHistoryIfnecessary()
	}

	get mergedHistory(): ImageCanvasEvent[] {
		return Array.from(this._history)
	}

	setMergedHistory(source: ImageCanvasEvent[][]): void {
		this._history = source.pop()!
	}

	cloneMergedHistory(): ImageCanvasEvent[][] {
		return [lodash.cloneDeep(this._history)]
	}
}

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
