import {
	ImageCanvasCommand,
	ImageCanvasEventType,
	ImageCanvasEventManager,
	ImageCanvasDrawer,
	ImageCanvasEventRevoker,
	ImageCanvasCommandValidator,
	UserId,
} from 'common'

import { App } from './app'
import { WebSocketApi } from './web-socket-api'

export interface CommandSender {
	command(cmd: ImageCanvasCommand): void
}

export class SocketCommandSender implements CommandSender {
	private readonly _validator: ImageCanvasCommandValidator
	constructor(
		private readonly _app: App,
		private readonly _manager: ImageCanvasEventManager,
		drawer: ImageCanvasDrawer,
		revoker: ImageCanvasEventRevoker,
		private readonly _api: WebSocketApi
	) {
		this._validator = new ImageCanvasCommandValidator(drawer, revoker)
	}

	start(): void {
		this._api.eventHappened.on((event) => {
			if (event.kind !== 'imageCanvasEvent') {
				return
			}

			this._manager.event(event.value)
		})
	}

	command(cmd: ImageCanvasCommand): void {
		const userId = this._app.userId
		if (userId === undefined) {
			throw new Error('コマンド早すぎ')
		}

		if (!this._validator.validate(userId, cmd)) {
			console.warn('不正なコマンド: ', cmd)
			return
		}

		this._api.sendCommand({ kind: 'imageCanvasCommand', value: cmd })
		this._pushVirtualEvent(userId, cmd)
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
		this._manager.event({
			id: 'virtual',
			userId: userId,
			isRevoked: false,
			isVirtual: true,
			eventType,
		})
	}
}
