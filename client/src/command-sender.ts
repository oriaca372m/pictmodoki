import { UserId } from 'common'
import { ImageCanvasCommand, ImageCanvasEventType } from 'common/dist/image-canvas'

import { App } from './app'
import { WebSocketApi } from './web-socket-api'
import { VirtualEventManager } from './virtual-event-manager'

export interface CommandSender {
	// コマンドが受容されればtrue
	command(cmd: ImageCanvasCommand): boolean
}

export class SocketCommandSender implements CommandSender {
	constructor(
		private readonly _app: App,
		private readonly _manager: VirtualEventManager,
		private readonly _api: WebSocketApi
	) {}

	start(): void {
		this._api.eventHappened.on((event) => {
			if (event.kind !== 'imageCanvasEvent') {
				return
			}

			this._manager.event(event.value)
			this._app.paintApp?.render()
			this._app.paintApp?.layerManager.update()
		})
	}

	command(cmd: ImageCanvasCommand): boolean {
		const userId = this._app.userId
		if (userId === undefined) {
			throw new Error('コマンド早すぎ')
		}

		const vev = this._genVirtualEvent(cmd)
		if (vev !== undefined) {
			if (!this._pushVirtualEvent(userId, vev)) {
				return false
			}
		}

		this._api.sendCommand({ kind: 'imageCanvasCommand', value: cmd })
		return true
	}

	private _genVirtualEvent(cmd: ImageCanvasCommand): ImageCanvasEventType | undefined {
		if (cmd.kind === 'drawLayer') {
			return {
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			}
		} else if (cmd.kind === 'revokeEvent') {
			return { kind: 'eventRevoked', eventId: cmd.eventId }
		}
	}

	private _pushVirtualEvent(userId: UserId, eventType: ImageCanvasEventType): boolean {
		const res = this._manager.virtualEvent({
			id: 'virtual',
			userId: userId,
			isRevoked: false,
			eventType,
		})

		if (res) {
			this._app.paintApp?.render()
			this._app.paintApp?.layerManager.update()
		}
		return res
	}
}
