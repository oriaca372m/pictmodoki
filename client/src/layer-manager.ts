import { ImageCanvasDrawer, LayerCanvasModel, LayerId } from 'common'
import { App } from './main'

export class LayerManager {
	private _selectedLayerId: LayerId | undefined
	private readonly _drawer: ImageCanvasDrawer

	constructor(private readonly _app: App) {
		this._drawer = this._app.imageCanvas
	}

	update(): void {
		if (this._selectedLayerId === undefined) {
			return
		}

		if (!this.selectLayerId(this._selectedLayerId)) {
			this._selectedLayerId = undefined
		}
	}

	// 成功したらtrue
	selectLayerId(layerId: LayerId): boolean {
		const found = this._app.imageCanvas.model.layers.find((x) => x.id === layerId)
		if (found === undefined) {
			return false
		}

		this._selectedLayerId = layerId
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
}
