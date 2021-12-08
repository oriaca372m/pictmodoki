const { Encoder } = require("./index.js");

const size = { width: 2000, height: 2000 };
const obj = new Encoder("test.mp4", size, { width: 1000, height: 1000 }, 60);
obj.init();

const buf = new Uint8Array(size.width * size.height * 4);
for (let i = 0; i < 600; ++i) {
	buf.fill(i % 256);
	obj.addBgra24Frame(buf);
}
obj.finish();
