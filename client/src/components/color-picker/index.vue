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
		</div>
		<div class="color-picker-sub">
			<ColorPreview class="color-preview" :value="rawColor" />
			<ColorCodeBox v-model="rawColor" />
		</div>
	</div>
</template>

<style scoped>
.color-picker {
	border: solid;
	padding: 7px;
	width: 260px;
}

.color-picker-main {
	height: 150px;
	display: flex;
	margin-bottom: 10px;
}

.color-picker-sub {
	display: flex;
	height: 30px;
}

.hue-bar, .opacity-bar {
	margin-left: 10px;
}

.sv-picker {
	position: relative;
	width: 200px;
	height: 150px;
	background-image:
		linear-gradient(to bottom, transparent, rgb(0, 0, 0)),
		linear-gradient(to right, rgb(255, 255, 255), rgba(255, 255, 255, 0));
}

.sv-cursor {
	position: absolute;
	transform: translate(-50%, -50%);
	border: solid;
	width: 6px;
	height: 6px;
	pointer-events: none;
}

.color-preview {
	width: 30px;
	height: 30px;
	margin-right: 10px;
}
</style>

<script src="./index-script"></script>
