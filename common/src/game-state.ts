import { UserId } from './user'

export interface GameState {
	mode: 'normal'
	limitPaintingToPainter: boolean

	state:
		| { kind: 'painting'; value: PaintingData }
		| { kind: 'waitingNext'; value: WaitingNextData }
		| { kind: 'finished' }

	userData: GameUserData[]
}

export interface PaintingData {
	painter: UserId
	answer: string | null

	timeLeft: number
	timeLimit: number
}

export interface WaitingNextData {
	respondent: UserId | null
	score: number | null

	currentPainting: PaintingData
	nextPainting: PaintingData
}

export interface GameUserData {
	userId: UserId
	name: string
	point: number | null
}
