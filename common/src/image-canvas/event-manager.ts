import { ImageCanvasEvent } from './event'
import lodash from 'lodash'

import { ImageCanvasEventExecutor } from './event-executor'

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
