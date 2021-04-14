<template>
	<div class="color-picker">
		<div class="color-picker-main">
			<div
				ref="svBox"
				class="sv-picker"
				@mousedown="svMouseDown($event)"
				:style="{ 'background-color': `hsl(${hue}, 100%, 50%)` }"
			>
				<div class="sv-cursor" :style="{ left: `${cursorX}px`, top: `${cursorY}px` }"></div>
			</div>
			<ColorBar class='hue-bar' type="hue" v-model="rawColor.hue" />
			<ColorBar class='opacity-bar' type="opacity" v-model="rawColor.opacity" />
			<div class="color-preview" :style="{ 'background-color': previewColor }"></div>
		</div>
		<ColorCodeBox v-model="rawColor" />
	</div>
</template>

<style scoped>
.color-picker {
	border: solid;
	padding: 10px;
	width: 300px;
}

.color-picker-main {
	height: 200px;
	display: flex;
	margin-bottom: 10px;
}

.hue-bar, .opacity-bar, .color-preview {
	margin-left: 10px;
}

.sv-picker {
	position: relative;
	width: 200px;
	height: 200px;
	background-image:
		linear-gradient(to bottom, rgb(0, 0, 0), transparent),
		linear-gradient(to right, rgb(255, 255, 255), rgba(255, 255, 255, 0));
}

.sv-cursor {
	position: absolute;
	transform: translate(-50%, -50%);
	border: solid;
	width: 10px;
	height: 10px;
	pointer-events: none;
}

.color-preview {
	width: 30px;
	height: 30px;
}
</style>

<script src="./index-script"></script>
