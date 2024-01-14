import { ImageCanvasEvent } from './event.js'
import lodash from 'lodash'

import { ImageCanvasEventExecutor } from './event-executor.js'

function costOfEvent(event: ImageCanvasEvent): number {
	if (event.eventType.kind === 'eventRevoked' || event.eventType.kind === 'eventRestored') {
		return 1
	}

	return 100
}

export class ImageCanvasEventManager {
	private _history: ImageCanvasEvent[] = []
	private _executor!: ImageCanvasEventExecutor

	private _totalEventsCost = 0
	private readonly _maxEventCostToPreserve = 5000

	get executor(): ImageCanvasEventExecutor {
		return this._executor
	}

	setExecutor(executor: ImageCanvasEventExecutor): void {
		this._executor = executor
	}

	setRealHistory(events: ImageCanvasEvent[]): void {
		this.breakHistory()
		this._history = events
		this._recalculateTotalEventsCost()
		this.executor.forceReExecute()
	}

	get realHistory(): readonly ImageCanvasEvent[] {
		return this._history
	}

	breakHistory(): void {
		this._history = []
		this._totalEventsCost = 0
	}

	private _recalculateTotalEventsCost(): void {
		this._totalEventsCost = this._history.reduce((acc, value) => acc + costOfEvent(value), 0)
	}

	protected _wipeHistoryIfnecessary(): void {
		const excessCost = this._totalEventsCost - this._maxEventCostToPreserve
		if (0 >= excessCost) {
			return
		}

		let costToReduce = 0
		let numToWipe = 0
		for (const event of this._history) {
			costToReduce += costOfEvent(event)
			numToWipe += 1

			if (costToReduce >= excessCost) {
				break
			}
		}

		const wiped = this._history.splice(0, numToWipe)
		this._totalEventsCost -= costToReduce
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
		this._totalEventsCost += costOfEvent(event)
		this._wipeHistoryIfnecessary()
	}

	get mergedHistory(): ImageCanvasEvent[] {
		return Array.from(this._history)
	}

	setMergedHistory(source: ImageCanvasEvent[][]): void {
		this._history = source.pop()!
		this._recalculateTotalEventsCost()
	}

	cloneMergedHistory(): ImageCanvasEvent[][] {
		return [lodash.cloneDeep(this._history)]
	}
}
