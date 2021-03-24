<template>
	<div>
		<canvas ref="canvas" width="800" height="800"></canvas>
		<div>
			<button @click="save">保存</button>
			<button @click="restore">復元</button>
			<button @click="undo">一つ戻す</button>
		</div>
		<div>
			<button @click="selectColor('#ff0000')">赤</button>
			<button @click="selectColor('#0000ff')">青</button>
			<button @click="selectColor('erase')">消しゴム</button>
		</div>
		<div v-for="layer in layers" :key="layer.id">
			<label><template v-if="layer.id === selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
			<button @click="selectLayerId(layer.id)">select</button>
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
		selectedLayerId: 'default'
	}),

	mounted: function() {
		this.app = main(this.$refs.canvas)

		setInterval(() => {
			this.layers = this.app.imageCanvas.model.layers
		}, 1000)
	},

	methods: {
		selectLayerId: function(id) {
			this.app.selectedLayerId = id
			this.selectedLayerId = id
		},

		selectColor: function(color) {
			if (color === 'erase') {
				this.app.penTool.mode = 'erase'
				return
			}
			this.app.penTool.mode = 'stroke'
			this.app.penTool.color = color
		},

		save: function() {
			this.savedCanvas = this.app.imageCanvas.cloneModel()
		},

		restore: function() {
			this.app.imageCanvas.setModel(this.savedCanvas.clone(this.app.imageCanvas.canvasProxyFactory))
			this.app.render()
		},

		undo: function() {
			this.app.undo()
		}
	}
}
</script>
