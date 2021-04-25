import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

import VueIndex from './views/index.vue'
import VueHome from './views/home.vue'
import VueRoom from './views/room.vue'
import VueColorPickerTest from './views/color-picker-test.vue'

const vueApp = createApp(VueIndex)

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', component: VueHome },
		{ path: '/color-picker-test', component: VueColorPickerTest },
		{ path: '/room/:serverAddr/:userName', name: 'room', component: VueRoom, props: true },
	],
})

vueApp.use(router)
vueApp.mount('#app')
