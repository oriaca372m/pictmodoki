const native = require("bindings")("encoder-native");
exports.Encoder = native.EncoderWrapper;
