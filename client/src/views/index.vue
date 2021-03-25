<template>
	<div>
		<canvas ref="canvas" width="800" height="800"></canvas>
		<div>
			<button @click="undo">一つ戻す</button>
		</div>
		<div>
			<button @click="selectColor('#ff0000')">赤</button>
			<button @click="selectColor('#0000ff')">青</button>
			<button @click="selectColor('erase')">消しゴム</button>
		</div>
		<div>
			<button @click="createLayer">レイヤー作成</button>
			<div v-for="layer in layers" :key="layer.id">
				<label><template v-if="layer.id === selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
				<button @click="selectLayerId(layer.id)">選択</button>
				<button @click="removeLayerId(layer.id)">削除</button>
			</div>
		</div>
		<p>hello vue!</p>
		<p>count: {{ counter }}</p>
		<button @click="counter += 1">increment</button>
	</div>
</template>

<script>
import { main } from '../main'

export default {
	data: () => ({
		app: undefined,
		savedCanvas: undefined,
		counter: 0,
		layers: [{ id: 'id1' }, { id: 'id2' }],
		selectedLayerId: undefined,
	}),

	mounted: function() {
		this.app = main(this.$refs.canvas)

		setInterval(() => {
			this.layers = this.app.layerManager.layers
			this.selectedLayerId = this.app.layerManager.selectedLayerId
		}, 1000)
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
			this.app.penTool.color = color
		},

		undo: function() {
			this.app.undo()
		}
	}
}
</script>
