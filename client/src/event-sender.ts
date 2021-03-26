import { ImageCanvasCommand, ImageCanvasEventType, ImageCanvasEventManager } from 'common'

import { App } from './main'
import { WebSocketApi } from './web-socket-api'

export interface CommandSender {
	command(cmd: ImageCanvasCommand): void
}

export class SocketCommandSender implements CommandSender {
	constructor(
		private _app: App,
		private _manager: ImageCanvasEventManager,
		private _api: WebSocketApi
	) {}

	start(): void {
		this._api.addEventHandler((event) => {
			if (event.kind !== 'imageCanvasEvent') {
				return
			}

			this._manager.event(event.value)
		})
	}

	command(cmd: ImageCanvasCommand): void {
		if (this._app.userId === undefined) {
			throw new Error('コマンド早すぎ')
		}

		this._api.sendCommand({ kind: 'imageCanvasCommand', value: cmd })
		this._pushVirtualEvent(cmd)
	}

	private _pushVirtualEvent(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(eventType: ImageCanvasEventType) {
		this._manager.event({
			id: 'virtual',
			userId: this._app.userId!,
			isRevoked: false,
			isVirtual: true,
			eventType,
		})
	}
}

export class DebugCommandSender implements CommandSender {
	private _eventId = 0
	private _layerId = 0
	constructor(private _manager: ImageCanvasEventManager) {}

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'createLayer') {
			this._pushEvent({ kind: 'layerCreated', layerId: this._layerId.toString() }, false)
			this._layerId++
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(eventType: ImageCanvasEventType, sendVirtualEvent = true) {
		if (sendVirtualEvent) {
			this._manager.event({
				id: 'virtual',
				userId: 'debugUser',
				isRevoked: false,
				isVirtual: true,
				eventType,
			})
		}

		const event = {
			id: this._eventId.toString(),
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: false,
			eventType,
		}
		this._eventId++

		setTimeout(() => {
			this._manager.event(event)
		}, 1000)
	}
}
