<template>
	<div class="app">
		<div class="canvas-area">
			<canvas ref="canvas" width="800" height="800"></canvas>
		</div>
		<div class="tool-area">
			<div>
				<button @click="undo">一つ戻す</button>
			</div>
			<div>
				<ChromePicker v-model="color" />
				<button @click="selectColor('#ff0000')">赤</button>
				<button @click="selectColor('#0000ff')">青</button>
				<button @click="selectColor('erase')">消しゴム</button>
			</div>
			<div>
				<input type="number" v-model="size">
			</div>
			<div>
				<button @click="createLayer">レイヤー作成</button>
				<div v-for="layer in layers" :key="layer.id">
					<label><template v-if="layer.id === selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
					<button @click="selectLayerId(layer.id)">選択</button>
					<button @click="removeLayerId(layer.id)">削除</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { main } from '../main'
import { Chrome as ChromePicker } from 'vue-color'

export default {
	props: ['serverAddr', 'userName'],

	data: () => ({
		app: undefined,
		layers: [],
		size: "10",
		color: '#ff0000ff',
		selectedLayerId: undefined,
	}),

	components: {
		ChromePicker
	},

	mounted: function() {
		this.app = main(this.$refs.canvas, this.serverAddr, this.userName)

		setInterval(() => {
			this.layers = this.app.layerManager.layers
			this.selectedLayerId = this.app.layerManager.selectedLayerId
		}, 1000)
	},

	watch: {
		color: function(value) {
			if (value.hex8) {
				this.app.penTool.color = value.hex8
			}
		},

		size: function(value) {
			this.app.penTool.width = parseInt(value, 10)
		}
	},

	methods: {
		selectLayerId: function(id) {
			const succeeded = this.app.layerManager.selectLayerId(id)
			if (succeeded) {
				this.selectedLayerId = id
			}
		},

		removeLayerId: function(id) {
			this.app.layerManager.removeLayer(id)
		},

		createLayer: function() {
			this.app.layerManager.createLayer()
		},

		selectColor: function(color) {
			if (color === 'erase') {
				this.app.penTool.mode = 'erase'
				return
			}
			this.app.penTool.mode = 'stroke'

			this.color = color
			this.app.penTool.color = color
		},

		undo: function() {
			this.app.undo()
		}
	}
}
</script>

<style>
.app {
	display: flex;
}
</style>
