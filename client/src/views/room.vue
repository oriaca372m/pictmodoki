<template>
	<div class="app">
		<div class="canvas-area">
			<canvas ref="canvas" width="3000" height="3000"></canvas>
		</div>
		<div class="tool-area">
			<div>
				<button @click="undo">一つ戻す</button>
			</div>
			<div>
				<ChromePicker v-model="color" />
				<button @click="pen">ペン</button>
				<button @click="selectColor('#000000')">黒</button>
				<button @click="selectColor('#ff0000')">赤</button>
				<button @click="selectColor('#0000ff')">青</button>
				<button @click="selectColor('erase')">消しゴム</button>
			</div>
			<div>
				<input type="number" v-model="size">
			</div>
			<div>
				<button @click="setSize(3)">3</button>
				<button @click="setSize(20)">20</button>
			</div>
			<div class="layer-selector">
				<button @click="createLayer">レイヤー作成</button>
				<draggable v-model="layers" @end="setLayerOrder">
					<div v-for="layer in layers" :key="layer.id">
						<button @click="selectLayerId(layer.id)">選択</button>
						<button @click="setLayerVisibility(layer.id, true)">表示</button>
						<button @click="setLayerVisibility(layer.id, false)">非表示</button>
						<button @click="removeLayerId(layer.id)">削除</button>
						<label><template v-if="layer.id === selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
					</div>
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
import { Chrome as ChromePicker } from 'vue-color'
import Draggable from 'vuedraggable'

export default {
	props: ['serverAddr', 'userName'],

	data: () => ({
		app: undefined,
		layers: [],
		size: "10",
		color: '#ff0000ff',
		selectedLayerId: undefined,
		messageToSend: '',
		chatMessages: [],
	}),

	components: {
		ChromePicker,
		Draggable,
	},

	mounted: function() {
		this.app = main(this.$refs.canvas, this.serverAddr, this.userName)

		this.app.ready.once(() => {
			this.app.chatManager.addMessageRecievedHandler((id, name, msg) => {
				this.chatMessages.push({ msgId: this.chatMessages.length, id, name, msg })
			})

			const layerUpdated = () => {
				this.layers = this.app.paintApp.imageCanvas.model.order.map(
					(x) => this.app.paintApp.imageCanvas.findLayerModelById(x)
				)
				this.selectedLayerId = this.app.paintApp.layerManager.selectedLayerId
			}

			this.app.paintApp.layerManager.updated.on(layerUpdated)
			layerUpdated()
		})
	},

	watch: {
		color: function(value) {
			if (value.hex8) {
				this.app.paintApp.penTool.color = value.hex8
			}
		},

		size: function(value) {
			this.app.paintApp.penTool.width = parseInt(value, 10)
		},
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
			this.app.paintApp.penTool.color = color
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
		}
	}
}
</script>

<style>
.app {
	display: flex;
}

.layer-selector {
	overflow: auto;
}
</style>
