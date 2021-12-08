#include "encoder.hpp"

#include <napi.h>

#include <memory>
#include <optional>

namespace {
	std::optional<Size> napi_value_to_size(Napi::Value value) {
		if (!value.IsObject()) {
			return std::nullopt;
		}

		auto obj = value.As<Napi::Object>();

		auto prop_width = obj.Get("width");
		auto prop_height = obj.Get("height");
		if (!prop_width.IsNumber() || !prop_height.IsNumber()) {
			return std::nullopt;
		}

		return Size{prop_width.As<Napi::Number>().Uint32Value(), prop_height.As<Napi::Number>().Uint32Value()};
	}

	std::optional<std::pair<std::uint8_t*, std::size_t>> napi_value_to_uint8_ptr(Napi::Value value) {
		std::optional<Napi::ArrayBuffer> buffer;

		if (value.IsArrayBuffer()) {
			buffer = value.As<Napi::ArrayBuffer>();
		} else if (value.IsTypedArray()) {
			buffer = value.As<Napi::TypedArray>().ArrayBuffer();
		} else {
			return std::nullopt;
		}

		return std::make_pair(
			static_cast<std::uint8_t*>(buffer->Data()), static_cast<std::size_t>(buffer->ByteLength()));
	}
}

class EncoderWrapper : public Napi::ObjectWrap<EncoderWrapper> {
public:
	static Napi::Object init(Napi::Env env, Napi::Object exports) {
		Encoder::init_class();

		auto func = DefineClass(
			env,
			"EncoderWrapper",
			{InstanceMethod("init", &EncoderWrapper::init),
			 InstanceMethod("addBgra24Frame", &EncoderWrapper::add_bgra24_frame),
			 InstanceMethod("finish", &EncoderWrapper::finish)});
		auto constructor = new Napi::FunctionReference();
		*constructor = Napi::Persistent(func);
		env.SetInstanceData(constructor);

		exports.Set("EncoderWrapper", func);
		return exports;
	};

	EncoderWrapper(const Napi::CallbackInfo& info) : Napi::ObjectWrap<EncoderWrapper>(info) {
		auto env = info.Env();

		if (info.Length() != 4 || !info[0].IsString() || !info[3].IsNumber()) {
			Napi::TypeError::New(env, "invalid arguments").ThrowAsJavaScriptException();
			return;
		}

		auto path = info[0].As<Napi::String>().Utf8Value();
		auto in_size = napi_value_to_size(info[1]);
		auto out_size = napi_value_to_size(info[2]);
		auto framerate = info[3].As<Napi::Number>().Int32Value();

		if (!in_size || !out_size) {
			Napi::TypeError::New(env, "invalid arguments").ThrowAsJavaScriptException();
			return;
		}

		encoder = std::make_unique<Encoder>(path, in_size.value(), out_size.value(), framerate);
	}

private:
	Napi::Value init(const Napi::CallbackInfo& info) {
		encoder->init();
		return info.Env().Undefined();
	};

	Napi::Value add_bgra24_frame(const Napi::CallbackInfo& info) {
		auto env = info.Env();
		auto buf = napi_value_to_uint8_ptr(info[0]);

		if (!buf) {
			Napi::TypeError::New(env, "invalid arguments").ThrowAsJavaScriptException();
			return env.Undefined();
		}

		encoder->add_bgra24_frame(buf->first, buf->second);
		return env.Undefined();
	}

	Napi::Value finish(const Napi::CallbackInfo& info) {
		encoder->finish();
		return info.Env().Undefined();
	}
	std::unique_ptr<Encoder> encoder;
};
