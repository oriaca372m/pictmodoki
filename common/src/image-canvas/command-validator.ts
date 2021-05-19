import { LayerId } from './layer'
import { ImageCanvasEventRevoker } from './event-manager'
import { ImageCanvasCommand } from './command'
import { ImageCanvasDrawer } from './image-canvas'
import { UserId } from '../user'
import * as u from '../utils'

export class ImageCanvasCommandValidator {
	constructor(
		private readonly _drawer: ImageCanvasDrawer,
		private readonly _revoker: ImageCanvasEventRevoker
	) {}

	private _isLayerFound(layerId: LayerId): boolean {
		return this._drawer.findLayerModelById(layerId) !== undefined
	}

	validate(userId: UserId, cmd: ImageCanvasCommand): boolean {
		if (cmd.kind === 'drawLayer') {
			return this._isLayerFound(cmd.layer)
		} else if (cmd.kind === 'createLayer') {
			return true
		} else if (cmd.kind === 'removeLayer') {
			return this._isLayerFound(cmd.layer)
		} else if (cmd.kind === 'revokeEvent') {
			return this._revoker.isRevokable(userId, cmd.eventId)
		} else if (cmd.kind === 'setLayerOrder') {
			return u.isSetsEqual(new Set(this._drawer.layers.map((x) => x.id)), new Set(cmd.order))
		}

		u.unreachable()
	}
}
