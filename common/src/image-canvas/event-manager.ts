import { ImageCanvasEvent } from './event'
import { ImageCanvasModel, ImageCanvasDrawer } from './image-canvas'
import { CanvasProxyFactory } from '../canvas-proxy'
import * as u from '../utils'
import lodash from 'lodash'

// Revoker用
import { UserId } from '../user'
import { ImageCanvasCommand } from './command'
import { ImageCanvasEventType, ImageCanvasEventId } from './event'

class EventPlayer {
	constructor(private readonly _event: ImageCanvasEvent) {}

	isAtomic(): boolean {
		const e = this._event.eventType

		if (e.kind === 'layerDrawn') {
			return true
		}

		return false
	}

	play(drawer: ImageCanvasDrawer): void {
		const p = this._event.eventType
		if (p.kind === 'layerDrawn') {
			drawer.drawLayer(p.layerId, p.drawCommand)
		} else if (p.kind === 'layerCreated') {
			drawer.createLayer(p.layerId)
		} else if (p.kind === 'layerRemoved') {
			drawer.removeLayer(p.layerId)
		} else if (p.kind === 'layerOrderChanged') {
			drawer.setLayerOrder(p.order)
		} else {
			throw new Error(`The event type '${p.kind}' is not implemented.`)
		}
	}
}

class EventReExecutor {
	private readonly _lastRenderedDrawer: ImageCanvasDrawer

	constructor(
		private readonly _manager: ImageCanvasEventManager,
		private readonly _canvasProxyFactory: CanvasProxyFactory,
		currentImageCanvasModel: ImageCanvasModel
	) {
		const model = currentImageCanvasModel.clone(this._canvasProxyFactory)
		this._lastRenderedDrawer = new ImageCanvasDrawer(model, _canvasProxyFactory)
	}

	getLastRenderedImageModel(): ImageCanvasModel {
		return this._lastRenderedDrawer.model
	}

	setLastRenderedImageModel(model: ImageCanvasModel): void {
		return this._lastRenderedDrawer.setModel(model)
	}

	private _playEvents(drawer: ImageCanvasDrawer, events: readonly ImageCanvasEvent[]): void {
		for (const event of events) {
			if (event.isRevoked || event.eventType.kind === 'eventRevoked') {
				continue
			}

			const player = new EventPlayer(event)
			player.play(drawer)
		}
	}

	applyWipedEvents(events: ImageCanvasEvent[]): void {
		this._playEvents(this._lastRenderedDrawer, events)
	}

	createReExecutedImageCanvasModel(): ImageCanvasModel {
		const model = this._lastRenderedDrawer.model.clone(this._canvasProxyFactory)
		const drawer = new ImageCanvasDrawer(model, this._canvasProxyFactory)
		this._playEvents(drawer, this._manager.mergedHistory)
		return model
	}
}

interface TransactionData {
	model: ImageCanvasModel
	history: ImageCanvasEvent[][]
}

export class ImageCanvasEventExecutor {
	private _reExecutor: EventReExecutor

	constructor(
		private readonly _manager: ImageCanvasEventManager,
		private readonly _drawer: ImageCanvasDrawer,
		private readonly _canvasProxyFactory: CanvasProxyFactory
	) {
		this._reExecutor = new EventReExecutor(_manager, _canvasProxyFactory, _drawer.model)
	}

	get reExecutor(): EventReExecutor {
		return this._reExecutor
	}

	get drawer(): ImageCanvasDrawer {
		return this._drawer
	}

	executeEvent(event: ImageCanvasEvent): boolean {
		let transaction: TransactionData | undefined
		const player = new EventPlayer(event)

		if (!player.isAtomic()) {
			transaction = {
				model: this._drawer.cloneModel(),
				history: this._manager.cloneMergedHistory(),
			}
		}

		try {
			if (event.eventType.kind === 'eventRevoked') {
				this._executeRevokeEvent(event)
			} else {
				player.play(this._drawer)
			}

			return true
		} catch (e) {
			console.log('Could not handle the event: ', e)
			if (transaction !== undefined) {
				console.log('event restored!')
				this._drawer.setModel(transaction.model)
				this._manager.setMergedHistory(transaction.history)
			}

			return false
		}
	}

	applyWipedEvents(events: ImageCanvasEvent[]): void {
		try {
			this._reExecutor.applyWipedEvents(events)
		} catch (e) {
			console.error('Failed to applyWipedEvents: ', e)

			this._manager.breakHistory()
			this._reExecutor = new EventReExecutor(
				this._manager,
				this._canvasProxyFactory,
				this._drawer.model
			)
		}
	}

	private _executeRevokeEvent(event: ImageCanvasEvent): void {
		if (event.eventType.kind !== 'eventRevoked') {
			u.unreachable()
		}

		const revokedId = event.eventType.eventId
		const target = this._manager.mergedHistory.find((x) => x.id === revokedId)
		if (target === undefined) {
			throw new Error('There is no target event!')
		}

		target.isRevoked = true
		const model = this._reExecutor.createReExecutedImageCanvasModel()
		this._drawer.setModel(model)
	}
}

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
