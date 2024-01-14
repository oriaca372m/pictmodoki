import { ImageCanvasEvent } from './image-canvas/event.js'
import { SerializedImageCanvasModel } from './image-canvas/image-canvas.js'
import { UserId } from './user.js'
import { GameState } from './game-state.js'

export type Event =
	| { kind: 'imageCanvasEvent'; value: ImageCanvasEvent }
	| {
			kind: 'canvasStateSet'
			value: SerializedImageCanvasModel
			log: readonly ImageCanvasEvent[]
	  }
	| { kind: 'userLoggedIn'; userId: UserId; name: string }
	| { kind: 'loginAccepted'; userId: UserId; name: string; reconnectionToken: string }
	| { kind: 'chatSent'; userId: UserId; name: string; message: string }
	| { kind: 'gameStateChanged'; value: GameState }
