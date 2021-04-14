<template>
	<div class="app">
		<div ref="canvasScrollContainer" class="canvas-area">
			<div ref="canvasContainer" class="canvas-container">
				<canvas :style="canvasStyle" ref="canvas" width="3000" height="3000"></canvas>
			</div>
		</div>
		<div class="tool-area">
			<div>
				<button @click="undo">一つ戻す</button>
			</div>
			<div>
				<h1>ツール選択</h1>
				<button @click="selectTool('pen')">ペン</button>
				<button @click="selectTool('spuit')">スポイト</button>
				<button @click="selectTool('eraser')">消しゴム</button>
			</div>
			<div>
				<ColorPicker v-model="color"/>
				<button @click="selectColor('#000000')">黒</button>
				<button @click="selectColor('#ff0000')">赤</button>
				<button @click="selectColor('#0000ff')">青</button>
			</div>
			<div>
				<h1>ペンの太さ</h1>
				<div>
					<button @click="setSize(3)">3</button>
					<button @click="setSize(20)">20</button>
					<input type="number" v-model="size">
				</div>
			</div>
			<div>
				<h1>消しゴムの太さ</h1>
				<div>
					<button @click="setEraserSize(3)">3</button>
					<button @click="setEraserSize(20)">20</button>
					<input type="number" v-model="eraserSize">
				</div>
			</div>
			<div>
				<div>
					<label>拡大率</label><input type="number" v-model="scale">
				</div>
				<div>
					<label>角度</label><input type="number" v-model="rotation">
				</div>
			</div>
			<div class="layer-selector">
				<button @click="createLayer">レイヤー作成</button>
				<draggable v-model="layers" item-key="id" @end="setLayerOrder">
					<template #item="{ element: layer }">
						<div>
							<button @click="selectLayerId(layer.id)">選択</button>
							<button @click="setLayerVisibility(layer.id, true)">表示</button>
							<button @click="setLayerVisibility(layer.id, false)">非表示</button>
							<button @click="removeLayerId(layer.id)">削除</button>
							<label><template v-if="layer.id === selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
						</div>
					</template>
				</draggable>
			</div>
			<div>
				<h1>チャット</h1>
				<div>
					<input v-model="messageToSend" @keyup.enter="sendChat">
					<button @click="sendChat">送信</button>
				</div>
				<div v-for="chat in chatMessages.slice().reverse()" :key="chat.msgId">
					<p>{{ chat.name }}: {{ chat.msg }}</p>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { main } from '../main'
import ColorPicker from '../components/color-picker'
import Draggable from 'vuedraggable'

export default {
	props: ['serverAddr', 'userName'],

	data: () => ({
		app: undefined,
		layers: [],
		size: 10,
		eraserSize: 20,
		color: '#ff0000',
		colorCode: '#00ff00',
		selectedLayerId: undefined,
		messageToSend: '',
		chatMessages: [],
		scale: 100,
		rotation: 0,
	}),

	components: {
		ColorPicker,
		Draggable,
	},

	computed: {
		canvasStyle: function() {
			return {
				transform: `scale(${this.scale / 100}) rotate(${this.rotation}deg)`
			}
		}
	},

	mounted: function() {
		console.log('test')
		this.$refs.canvasScrollContainer.scrollTop = 5000
		this.$refs.canvasScrollContainer.scrollLeft = 5000

		this.app = main(this.$refs.canvasContainer, this.$refs.canvas, this.serverAddr, this.userName)
		console.log(this.app)

		this.app.ready.once(() => {
			this.app.chatManager.addMessageRecievedHandler((id, name, msg) => {
				this.chatMessages.push({ msgId: this.chatMessages.length, id, name, msg })
			})

			const layerUpdated = () => {
				this.layers = this.app.paintApp.imageCanvas.model.order.map(
					(x) => {
						const layer = this.app.paintApp.imageCanvas.findLayerModelById(x)
						return { id: layer.id, name: layer.name }
					}
				)
				this.selectedLayerId = this.app.paintApp.layerManager.selectedLayerId
			}

			this.app.paintApp.layerManager.updated.on(layerUpdated)
			layerUpdated()
		})
	},

	watch: {
		color: function(value) {
			if (this.app && value.rgbCode) {
				this.app.paintApp.penTool.color = value.rgbCode
			}
		},

		size: function(value) {
			this.app.paintApp.penTool.width = value
		},

		eraserSize: function(value) {
			this.app.paintApp.eraserTool.width = value
		},

		scale: function(value) {
			this.app.paintApp.canvasScale = value / 100
		},

		rotation: function(value) {
			this.app.paintApp.canvasRotation = Math.PI * value / 180
		}
	},

	methods: {
		setLayerOrder: function() {
			this.app.paintApp.layerManager.setLayerOrder(this.layers.map(x => x.id))
		},

		selectLayerId: function(id) {
			const succeeded = this.app.paintApp.layerManager.selectLayerId(id)
			if (succeeded) {
				this.selectedLayerId = id
			}
		},

		setSize: function(value) {
			this.size = value
		},

		setEraserSize: function(value) {
			this.eraser = value
		},

		removeLayerId: function(id) {
			this.app.paintApp.layerManager.removeLayer(id)
		},

		createLayer: function() {
			this.app.paintApp.layerManager.createLayer()
		},

		pen: function() {
			this.app.paintApp.penTool.mode = 'stroke'
		},

		selectColor: function(color) {
			if (color === 'erase') {
				this.app.paintApp.penTool.mode = 'erase'
				return
			}
			this.app.paintApp.penTool.mode = 'stroke'

			this.color = color
		},

		undo: function() {
			this.app.paintApp.undo()
		},

		setLayerVisibility: function(id, isVisible) {
			this.app.paintApp.layerManager.setLayerVisibility(id, isVisible)
		},

		sendChat: function() {
			if (this.messageToSend === '') {
				return
			}
			this.app.chatManager.sendMessage(this.messageToSend)
			this.messageToSend = ''
		},

		selectTool: function(name) {
			this.app.paintApp.toolManager.selectTool(name)
		}
	}
}
</script>

<style>
.app {
	display: flex;
	width: 100%;
	height: 100%;
	overflow: auto;
}

.layer-selector {
	overflow: auto;
}

.canvas-area {
	flex: 1;
	overflow: auto;
}

.canvas-container {
	display: flex;
	width: 10000px;
	height: 10000px;
	align-items: center;
	justify-content: center;
	background-color: lightgray;
}

.canvas-container canvas {
	background-color: white;
}

.tool-area {
	width: 350px;
	overflow: auto;
}

.tool-area h1 {
	font-size: 1rem;
	margin: 0;
}
</style>
