<template>
	<div ref="bar" :class="['color-bar', `${type}-color-bar`]"
		@mouseenter="mouseenter"
		@mouseleave="mouseleave"
		@mousedown="mousedown($event)"
	>
		<div class="color-bar-cursor" :style="{ left: '10px', top: `${cursory}px` }"></div>
	</div>
</template>

<style scoped>
.color-bar {
	position: relative;
	width: 20px;
	height: 150px;
}

.hue-color-bar {
	background-image: linear-gradient(
		to bottom,
		hsl(0,100%,50%),
		hsl(60,100%,50%),
		hsl(120,100%,50%),
		hsl(180,100%,50%),
		hsl(240,100%,50%),
		hsl(300,100%,50%),
		hsl(360,100%,50%)
	);
}

.opacity-color-bar {
	background-image: linear-gradient(
		to bottom,
		#000000,
		transparent
	);
}

.color-bar-cursor {
	position: absolute;
	transform: translate(-50%, -50%);
	width: 10px;
	height: 4px;
	background-color: black;
	pointer-events: none;
}

.opacity-color-bar .color-bar-cursor {
	background-color: red;
}
</style>

<script src="./color-bar-script"></script>
