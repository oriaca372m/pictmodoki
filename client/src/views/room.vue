<template>
	<div class="app">
		<div ref="canvasScrollContainer" class="canvas-area">
			<div ref="canvasContainer" class="canvas-container"></div>
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
				<button @click="selectTool('moving')">移動</button>
			</div>
			<div>
				<ColorPicker v-model="state.color"/>
				<button @click="selectColor('#000000')">黒</button>
				<button @click="selectColor('#ff0000')">赤</button>
				<button @click="selectColor('#0000ff')">青</button>
			</div>
			<div>
				<h1>ペンの太さ</h1>
				<div>
					<button @click="state.size = 3">3</button>
					<button @click="state.size = 20">20</button>
					<input type="number" v-model="state.size">
				</div>
			</div>
			<div>
				<h1>消しゴムの太さ</h1>
				<div>
					<button @click="state.eraserSize = 3">3</button>
					<button @click="state.eraserSize = 20">20</button>
					<input type="number" v-model="state.eraserSize">
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
				<draggable v-model="state.layers" item-key="id" @end="setLayerOrder">
					<template #item="{ element: layer }">
						<div>
							<button @click="selectLayerId(layer.id)">選択</button>
							<button @click="setLayerVisibility(layer.id, true)">表示</button>
							<button @click="setLayerVisibility(layer.id, false)">非表示</button>
							<button @click="removeLayerId(layer.id)">削除</button>
							<label><template v-if="layer.id === state.selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
						</div>
					</template>
				</draggable>
			</div>
			<div>
				<h1>チャット</h1>
				<div>
					<input v-model="state.messageToSend" @keyup.enter="sendChat">
					<button @click="sendChat">送信</button>
				</div>
				<div v-for="chat in state.chatMessages.slice().reverse()" :key="chat.msgId">
					<p>{{ chat.name }}: {{ chat.msg }}</p>
				</div>
			</div>
		</div>
	</div>
</template>

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

<script src="./room-script"></script>
