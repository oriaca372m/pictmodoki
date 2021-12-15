<template>
	<router-view></router-view>
</template>

<style>
*,
*::before,
*::after {
	box-sizing: border-box;
}

* {
	margin: 0;
	overflow-wrap: break-word;
}

html,
body,
#app {
	height: 100%;
}

body {
	line-height: 1.5;
}

img,
picture,
video,
canvas,
svg {
	display: block;
	max-width: 100%;
}

input,
button,
textarea,
select {
	font: inherit;
}

:root {
	--color-primary: #63aeff;
}

.el_triangleUp {
	width: 0;
	height: 0;
	border-style: solid;
	border-width: 0 calc(var(--triangle-size) / 2) var(--triangle-size)
		calc(var(--triangle-size) / 2);
	border-color: transparent transparent var(--triangle-color) transparent;
}

.el_triangleDown {
	width: 0;
	height: 0;
	border-style: solid;
	border-color: transparent transparent var(--triangle-color) transparent;
	border-width: var(--triangle-size) calc(var(--triangle-size) / 2) 0
		calc(var(--triangle-size) / 2);
	border-color: var(--triangle-color) transparent transparent transparent;
}

.el_center {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1ch;

	width: 100%;
	height: 100%;
}
</style>
