#include <napi.h>

#include "encoder_wrapper.cpp"

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
	return EncoderWrapper::init(env, exports);
}

NODE_API_MODULE(encoder, Init)
