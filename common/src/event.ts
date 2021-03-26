import { ImageCanvasEvent } from './image-canvas-event'
import { SerializedImageCanvasModel } from './image-canvas'
import { UserId } from './user'

export type Event =
	| { kind: 'imageCanvasEvent'; value: ImageCanvasEvent }
	| { kind: 'dataSent'; value: SerializedImageCanvasModel; log: readonly ImageCanvasEvent[] }
	| { kind: 'userLoggedIn'; userId: UserId; name: string }
	| { kind: 'loginAccepted'; userId: UserId; name: string; reconnectionToken: string }
	| { kind: 'chatSent'; userId: UserId; name: string; message: string }
