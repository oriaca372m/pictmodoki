import { ImageCanvasDrawer, LayerCanvasModel, LayerId } from 'common'
import { PaintApp } from './main'
import { TypedEvent } from './typed-event'

export class LayerManager {
	private _selectedLayerId: LayerId | undefined
	private readonly _drawer: ImageCanvasDrawer
	readonly updated = new TypedEvent<void>()

	constructor(private readonly _app: PaintApp) {
		this._drawer = this._app.imageCanvas
	}

	update(): void {
		if (this._selectedLayerId === undefined) {
			this.updated.emit()
			return
		}

		if (!this.selectLayerId(this._selectedLayerId)) {
			this._selectedLayerId = undefined
		}
		this.updated.emit()
	}

	// 成功したらtrue
	selectLayerId(layerId: LayerId): boolean {
		const found = this._app.imageCanvas.findLayerModelById(layerId)
		if (found === undefined) {
			return false
		}

		this._selectedLayerId = layerId
		this.updated.emit()
		return true
	}

	createLayer(): void {
		this._app.commandSender.command({ kind: 'createLayer' })
	}

	removeLayer(layerId: LayerId): void {
		this._app.commandSender.command({ kind: 'removeLayer', layer: layerId })
	}

	get selectedLayerId(): LayerId | undefined {
		return this._selectedLayerId
	}

	get layers(): readonly LayerCanvasModel[] {
		return this._app.imageCanvas.model.layers
	}

	setLayerVisibility(id: LayerId, isVisible: boolean): void {
		this._drawer.setLayerVisibility(id, isVisible)
		this._app.render()
		this.updated.emit()
	}

	setLayerOrder(order: LayerId[]): void {
		this._app.commandSender.command({ kind: 'setLayerOrder', order })
	}
}
