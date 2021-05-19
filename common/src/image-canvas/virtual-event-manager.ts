import { ImageCanvasEvent } from './event'
import { ImageCanvasEventManager } from './event-manager'
import lodash from 'lodash'

// virtual eventとreal eventの等価性を確認する
function isEqualVirtualRealEvent(real: ImageCanvasEvent, virtual: ImageCanvasEvent): boolean {
	if (real.userId !== virtual.userId) {
		return false
	}

	return lodash.isEqual(real.eventType, virtual.eventType)
}

export class VirtualEventManager extends ImageCanvasEventManager {
	private _virtualHistory: ImageCanvasEvent[] = []

	breakHistory(): void {
		super.breakHistory()
		this._virtualHistory = []
	}

	virtualEvent(event: ImageCanvasEvent): boolean {
		if (!this.executor.executeEvent(event)) {
			return false
		}

		this._virtualHistory.push(event)
		return true
	}

	event(event: ImageCanvasEvent): boolean {
		const vevent = this._virtualHistory.shift()
		if (vevent === undefined) {
			return super.event(event)
		}

		if (isEqualVirtualRealEvent(event, vevent)) {
			this._determineEvent(event)
			return true
		} else {
			this._virtualHistory = []
			const rollbacked = this.executor.reExecutor.createReExecutedImageCanvasModel()
			this.executor.drawer.setModel(rollbacked)
			return super.event(event)
		}
	}

	get mergedHistory(): ImageCanvasEvent[] {
		return super.mergedHistory.concat(this._virtualHistory)
	}

	setMergedHistory(source: ImageCanvasEvent[][]): void {
		this._virtualHistory = source.pop()!
		super.setMergedHistory(source)
	}

	cloneMergedHistory(): ImageCanvasEvent[][] {
		const clone = super.cloneMergedHistory()
		clone.push(lodash.cloneDeep(this._virtualHistory))
		return clone
	}
}
