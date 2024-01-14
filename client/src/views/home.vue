<template>
	<div>
		<div>
			<label>サーバーアドレス</label><input v-model="serverAddr">
		</div>
		<div>
			<label>ユーザー名</label><input v-model="userName">
		</div>
		<button @click="joinRoom">入室</button>
	</div>
</template>

<style>
</style>

<script src="./home-script.ts"></script>
