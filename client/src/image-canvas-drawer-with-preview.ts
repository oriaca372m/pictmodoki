import {
	LayerCanvasModel,
	LayerDrawer,
	LayerDrawCommand,
	ImageCanvasDrawer,
	ImageCanvasModel,
	LayerId,
	CanvasProxy,
	CanvasDrawer,
} from 'common'

interface PreviewInfo {
	originalLayer: LayerCanvasModel
	previewLayer: LayerDrawer
	command?: LayerDrawCommand
	drawnCommand?: LayerDrawCommand
}

export class ImageCanvasDrawerWithPreview extends ImageCanvasDrawer {
	private _previewInfo: PreviewInfo | undefined
	private _shouldUpdateCache = true
	private _cacheTop!: LayerDrawer
	private _cacheBottom!: LayerDrawer

	setModel(model: ImageCanvasModel): void {
		super.setModel(model)

		this._shouldUpdateCache = true
		this._cacheTop = new LayerDrawer(this.canvasProxyFactory.createCanvasProxy(model.size))
		this._cacheBottom = new LayerDrawer(this.canvasProxyFactory.createCanvasProxy(model.size))

		if (this._previewInfo === undefined) {
			return
		}

		const found = this.findLayerModelById(this._previewInfo.originalLayer.id)
		if (found !== undefined) {
			this._setPreviewInfo(found)
		} else {
			this.endPreview()
		}
	}

	setLayerVisibility(layerId: LayerId, isVisible: boolean): void {
		super.setLayerVisibility(layerId, isVisible)
		this._shouldUpdateCache = true
	}

	removeLayer(id: LayerId): void {
		super.removeLayer(id)
		this._shouldUpdateCache = true

		if (this._previewInfo !== undefined && this._previewInfo.originalLayer.id === id) {
			this.endPreview()
		}
	}

	setLayerOrder(order: LayerId[]): void {
		super.setLayerOrder(order)
		this._shouldUpdateCache = true
	}

	drawLayer(id: LayerId, drawCmd: LayerDrawCommand): void {
		super.drawLayer(id, drawCmd)
		this._shouldUpdateCache = true
	}

	startPreview(layer: LayerId): void {
		if (this._previewInfo !== undefined && this._previewInfo.originalLayer.id === layer) {
			return
		}

		this.endPreview()
		const found = this.findLayerModelById(layer)
		if (found !== undefined) {
			this._setPreviewInfo(found)
		}
	}

	private _setPreviewInfo(originalLayer: LayerCanvasModel): void {
		this._previewInfo = {
			originalLayer,
			previewLayer: new LayerDrawer(
				this.canvasProxyFactory.createCanvasProxy(this._model.size)
			),
		}
	}

	drawPreview(drawCmd: LayerDrawCommand): void {
		if (this._previewInfo === undefined) {
			throw new Error('startPreview() must be called before calling drawPreview().')
		}

		this._previewInfo.command = drawCmd
	}

	private _updatePreview(force = false): void {
		const info = this._previewInfo!
		if (!force && info.command === info.drawnCommand) {
			return
		}

		const drawer = info.previewLayer.canvasDrawer
		drawer.clear()
		drawer.drawCanvasProxy(info.originalLayer.canvasProxy)

		info.drawnCommand = info.command
		if (info.command !== undefined) {
			info.previewLayer.command(info.command)
		}
	}

	endPreview(): void {
		this._previewInfo = undefined
		this._shouldUpdateCache = true
	}

	render(canvas: CanvasProxy): void {
		if (this._previewInfo === undefined) {
			super.render(canvas)
			return
		}

		if (this._shouldUpdateCache) {
			this._updateCache()
		}

		this._updatePreview()
		this._cacheRender(canvas)
	}

	private _cacheRender(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()

		drawer.drawCanvasProxy(this._cacheBottom.canvasProxy)

		const info = this._previewInfo!
		const controller = this._layerControllers.get(info.originalLayer)!
		if (controller.isVisible) {
			drawer.drawCanvasProxy(info.previewLayer.canvasProxy)
		}
		drawer.drawCanvasProxy(this._cacheTop.canvasProxy)
	}

	private _updateCache(): void {
		const bottomDrawer = new CanvasDrawer(this._cacheBottom.canvasProxy)
		const topDrawer = new CanvasDrawer(this._cacheTop.canvasProxy)
		bottomDrawer.clear()
		topDrawer.clear()

		let isDrawingBottom = true

		for (const id of this._model.order) {
			if (this._previewInfo!.originalLayer.id === id) {
				isDrawingBottom = false
				continue
			}

			const controller = this._idToControllerMap.get(id)!
			if (!controller.isVisible) {
				continue
			}

			const drawer = isDrawingBottom ? bottomDrawer : topDrawer
			drawer.drawCanvasProxy(controller.drawer.canvasProxy)
		}

		this._updatePreview(true)
		this._shouldUpdateCache = false
	}
}
