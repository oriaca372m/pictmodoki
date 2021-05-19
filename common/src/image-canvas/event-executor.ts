import { ImageCanvasEvent } from './event'
import { ImageCanvasModel, ImageCanvasDrawer } from './image-canvas'
import { CanvasProxyFactory } from '../canvas-proxy'
import { ImageCanvasEventManager } from './event-manager'
import * as u from '../utils'

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
			console.error(
				'これはバグです。上のエラーメッセージを付けて開発者に報告してください。https://github.com/oriaca372m/pictmodoki/issues'
			)

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
		this.forceReExecute()
	}

	forceReExecute(): void {
		const model = this._reExecutor.createReExecutedImageCanvasModel()
		this._drawer.setModel(model)
	}
}
