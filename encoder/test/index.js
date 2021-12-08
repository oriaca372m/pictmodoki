const native = require("bindings")("encoder-native");

const size = { width: 2000, height: 2000 };
const obj = new native.EncoderWrapper("test.mp4", size, size, 60);
obj.init();

const buf = new Uint8Array(size.width * size.height * 3);
for (let i = 0; i < 6000; ++i) {
	buf.fill(i % 256);
	obj.addFrame(buf);
}
obj.finish();
