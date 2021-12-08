cmake_minimum_required(VERSION 3.22)
cmake_policy(SET CMP0042 NEW)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

project(encoder-native)
add_library(${PROJECT_NAME} SHARED
	"src/main.cpp"
)
set_target_properties(${PROJECT_NAME} PROPERTIES
	CXX_STANDARD 17
	CXX_STANDARD_REQUIRED ON
	PREFIX ""
	SUFFIX ".node"
)

# Include Node-API wrappers
execute_process(
	COMMAND node -p "require('node-addon-api').include"
	WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
	OUTPUT_VARIABLE NODE_ADDON_API_DIR
)
string(REGEX REPLACE "[\r\n\"]" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

target_include_directories(${PROJECT_NAME} PRIVATE
	${CMAKE_JS_INC}
	${NODE_ADDON_API_DIR}
)

find_package(PkgConfig REQUIRED)
pkg_check_modules(libavutil REQUIRED IMPORTED_TARGET libavutil)
pkg_check_modules(libavcodec REQUIRED IMPORTED_TARGET libavcodec)
pkg_check_modules(libavformat REQUIRED IMPORTED_TARGET libavformat)
pkg_check_modules(libswscale REQUIRED IMPORTED_TARGET libswscale)

find_package(fmt REQUIRED)

find_package(Boost REQUIRED COMPONENTS)

target_link_libraries(${PROJECT_NAME} PRIVATE
	${CMAKE_JS_LIB}
	PkgConfig::libavutil
	PkgConfig::libavcodec
	PkgConfig::libavformat
	PkgConfig::libswscale
	fmt::fmt
	Boost::boost
)

add_definitions(-DNAPI_VERSION=4)
