import { UserId } from 'common'
import {
	ImageCanvasCommand,
	ImageCanvasEventType,
	VirtualEventManager,
} from 'common/dist/image-canvas'

import { App } from './app'
import { WebSocketApi } from './web-socket-api'

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

		this._api.sendCommand({ kind: 'imageCanvasCommand', value: cmd })
		this._pushVirtualEvent(userId, cmd)
		return true
	}

	private _pushVirtualEvent(userId: UserId, cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent(userId, {
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent(userId, { kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(userId: UserId, eventType: ImageCanvasEventType) {
		this._manager.virtualEvent({
			id: 'virtual',
			userId: userId,
			isRevoked: false,
			eventType,
		})

		this._app.paintApp?.render()
		this._app.paintApp?.layerManager.update()
	}
}
