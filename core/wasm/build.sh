#!/bin/bash
# build.sh - Fixed for latest Emscripten

echo "Building SpatialGrid WebAssembly module..."

mkdir -p build

em++ spatial_grid.cpp \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createSpatialGridModule" \
  -s EXPORT_ES6=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16MB \
  -s ENVIRONMENT='web' \
  -s SINGLE_FILE=0 \
  -s FILESYSTEM=0 \
  --bind \
  -o build/spatial_grid.js

echo "Build complete!"
ls -lh build/spatial_grid.*