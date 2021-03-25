import { Size } from './primitives'
import { LayerId, LayerDrawCommand } from './layer'
import { UserId } from './user'
import { ImageCanvasModel, ImageCanvasDrawer } from './image-canvas'
import { ImageCanvasCommand } from './image-canvas-command'
import { CanvasProxyFactory } from './canvas-proxy'

export type ImageCanvasEventType =
	| { kind: 'canvasInitialized'; size: Size }
	| { kind: 'layerCreated'; layerId: LayerId }
	| { kind: 'layerRemoved'; layerId: LayerId }
	| { kind: 'eventRevoked'; eventId: ImageCanvasEventId }
	| { kind: 'eventRestored'; eventId: ImageCanvasEventId }
	| { kind: 'layerDrawn'; layerId: LayerId; drawCommand: LayerDrawCommand }

export type ImageCanvasEventId = string

export interface ImageCanvasEvent {
	id: ImageCanvasEventId
	userId: UserId
	isRevoked: boolean
	isVirtual: boolean
	eventType: ImageCanvasEventType
}

// virtual eventとreal eventの等価性を確認する
function isEqualVirtualRealEvent(real: ImageCanvasEvent, virtual: ImageCanvasEvent): boolean {
	if (real.userId !== virtual.userId) {
		return false
	}

	return JSON.stringify(real.eventType) === JSON.stringify(virtual.eventType)
}

export class ImageCanvasEventPlayer {
	constructor(private readonly _drawer: ImageCanvasDrawer) {}

	play(events: readonly ImageCanvasEvent[]): void {
		for (const event of events) {
			this.playSingleEvent(event)
		}
	}

	playSingleEvent(event: ImageCanvasEvent): void {
		if (event.isRevoked) {
			return
		}

		const p = event.eventType
		if (p.kind === 'layerDrawn') {
			this._drawer.drawLayer(p.layerId, p.drawCommand)
		} else if (p.kind === 'layerCreated') {
			this._drawer.createLayer(p.layerId)
		} else if (p.kind === 'layerRemoved') {
			this._drawer.removeLayer(p.layerId)
		}
	}
}

export interface ImageCanvasEventManagerPlugin {
	onEvent(event: ImageCanvasEvent): void
	onHistoryChanged(): void
	onHistoryWiped(wipedEvents: ImageCanvasEvent[]): void
}

export class ImageCanvasEventManager {
	private _history: ImageCanvasEvent[] = []
	private _plugins: ImageCanvasEventManagerPlugin[] = []
	private _lastRealEvent = -1
	private _isClean = true
	private _numRealEventToPreserve = 50

	registerPlugin(plugin: ImageCanvasEventManagerPlugin): void {
		this._plugins.push(plugin)
	}

	get isClean(): boolean {
		return this._isClean
	}

	// toIndexは最後の正しいエントリのインデックス
	private _rewindHistory(toIndex: number): void {
		this._history.splice(toIndex + 1)
		this._lastRealEvent = this._lastIndex
		this._plugins.forEach((x) => {
			x.onHistoryChanged()
		})
	}

	setHistory(events: readonly ImageCanvasEvent[]): void {
		this._history = Array.from(events)
		this._lastRealEvent = this._lastIndex
		this._plugins.forEach((x) => {
			x.onHistoryChanged()
		})
	}

	private _wipeHistoryIfnecessary(): void {
		if (!this._isClean) {
			return
		}

		const numToWipe = this._history.length - this._numRealEventToPreserve
		if (numToWipe < 1) {
			return
		}

		const wiped = this._history.splice(0, numToWipe)
		this._lastRealEvent -= numToWipe
		this._plugins.forEach((x) => {
			x.onHistoryWiped(wiped)
		})
	}

	// historyの最後の要素のインデックス
	private get _lastIndex(): number {
		return this._history.length - 1
	}

	// 戻り値: 処理を終了するべきか
	private _pushRealEvent(event: ImageCanvasEvent): boolean {
		if (this._lastRealEvent === this._lastIndex) {
			this._history.push(event)
			this._lastRealEvent++
			this._isClean = true
			return false
		}

		const vevent = this._history[this._lastRealEvent + 1]
		if (isEqualVirtualRealEvent(event, vevent)) {
			vevent.id = event.id
			vevent.isVirtual = false
			this._lastRealEvent++
			this._isClean = this._lastRealEvent === this._lastIndex
			return true
		} else {
			console.log('この近くでバグったら多分ここが悪い01')
			this._rewindHistory(this._lastRealEvent)
			this._history.push(event)
			this._lastRealEvent = this._lastIndex
			this._isClean = true
			return false
		}
	}

	event(event: ImageCanvasEvent): void {
		if (event.isVirtual) {
			this._history.push(event)
			this._isClean = false
		} else {
			const shouldExit = this._pushRealEvent(event)
			this._wipeHistoryIfnecessary()
			if (shouldExit) {
				return
			}
		}

		let historyChanged = false
		if (event.eventType.kind === 'eventRevoked') {
			const revokedId = event.eventType.eventId
			this._history.find((x) => x.id === revokedId)!.isRevoked = true
			historyChanged = true
		}

		this._plugins.forEach((x) => {
			x.onEvent(event)
		})

		if (historyChanged) {
			this._plugins.forEach((x) => {
				x.onHistoryChanged()
			})
		}
	}

	get history(): readonly ImageCanvasEvent[] {
		return this._history
	}

	getReversedHistory(): ImageCanvasEvent[] {
		return Array.from(this._history).reverse()
	}
}

export class ImageCanvasUndoManager implements ImageCanvasEventManagerPlugin {
	private readonly _lastRenderedDrawer: ImageCanvasDrawer
	private readonly _lastRenderedEventPlayer: ImageCanvasEventPlayer

	constructor(
		private readonly _eventManager: ImageCanvasEventManager,
		private readonly _canvasProxyFactory: CanvasProxyFactory,
		currentImageCanvasModel: ImageCanvasModel
	) {
		const model = currentImageCanvasModel.clone(this._canvasProxyFactory)
		this._lastRenderedDrawer = new ImageCanvasDrawer(model, _canvasProxyFactory)
		this._lastRenderedEventPlayer = new ImageCanvasEventPlayer(this._lastRenderedDrawer)
	}

	getLastRenderedImageModel(): ImageCanvasModel {
		return this._lastRenderedDrawer.model
	}

	setLastRenderedImageModel(model: ImageCanvasModel): void {
		return this._lastRenderedDrawer.setModel(model)
	}

	onEvent(): void {
		// pass
	}

	onHistoryChanged(): void {
		// pass
	}

	onHistoryWiped(events: ImageCanvasEvent[]): void {
		this._lastRenderedEventPlayer.play(events)
	}

	createUndoedImageCanvasModel(): ImageCanvasModel {
		const model = this._lastRenderedDrawer.model.clone(this._canvasProxyFactory)
		const drawer = new ImageCanvasDrawer(model, this._canvasProxyFactory)
		const player = new ImageCanvasEventPlayer(drawer)
		player.play(this._eventManager.history)
		return model
	}
}

export class ImageCanvasEventRevoker {
	static readonly unrevokableEvents: ImageCanvasEventType['kind'][] = [
		'eventRevoked',
		'layerCreated',
	]

	constructor(private readonly _eventManager: ImageCanvasEventManager) {}

	isRevokable(userId: UserId, eventId: ImageCanvasEventId): boolean {
		const event = this._eventManager.history.find((x) => x.id === eventId)
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
		if (this._eventManager.isClean) {
			return true
		}

		for (const event of this._eventManager.getReversedHistory()) {
			if (event.isVirtual) {
				if (event.eventType.kind !== 'eventRevoked') {
					return false
				}
			} else {
				return true
			}
		}

		return true
	}

	createUndoCommand(userId: UserId): ImageCanvasCommand | undefined {
		if (!this._canCreateUndoCommand()) {
			return
		}
		const event = this._eventManager
			.getReversedHistory()
			.find(
				(x) =>
					!x.isVirtual &&
					x.eventType.kind !== 'eventRevoked' &&
					x.userId === userId &&
					!x.isRevoked
			)
		if (event === undefined || !this.isRevokable(userId, event.id)) {
			return
		}

		return { kind: 'revokeEvent', eventId: event.id }
	}
}
