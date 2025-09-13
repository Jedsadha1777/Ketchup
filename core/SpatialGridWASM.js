// core/SpatialGridWASM.js - Fixed version
import createSpatialGridModule from '../core/wasm/build/spatial_grid.js';

export class SpatialGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.wasmGrid = null;
        this.wasmModule = null;
        this.isReady = false;
        this.initPromise = this.init();
        this.RadiusPrecision = null;
    }

    async init() {
        try {
            this.wasmModule = await createSpatialGridModule();

            this.RadiusPrecision = {
                SQUARE: this.wasmModule.RadiusPrecision.SQUARE,
                CENTER: this.wasmModule.RadiusPrecision.CENTER,
                BOUNDS: this.wasmModule.RadiusPrecision.BOUNDS
            };

            this.wasmGrid = new this.wasmModule.SpatialGrid(this.cellSize);
            this.isReady = true;

            console.log('WASM SpatialGrid initialized');
        } catch (error) {
            console.error('Failed to initialize WASM SpatialGrid:', error);
            throw error;
        }
    }

    async ensureReady() {
        if (!this.isReady) {
            await this.initPromise;
        }
    }

    // Sync versions for compatibility
    addObject(id, x, y, width, height) {
        if (!this.isReady) return;
        this.wasmGrid.addObject(id, x, y, width, height);
    }

    removeObject(id) {
        if (!this.isReady) return;
        this.wasmGrid.removeObject(id);
    }

    updateObject(id, x, y, width, height) {
        if (!this.isReady) return;
        this.wasmGrid.updateObject(id, x, y, width, height);
    }

    getObjectsAt(x, y) {
        if (!this.isReady) return new Set();
        const result = this.wasmGrid.getObjectsAt(x, y);

        // Emscripten vector มี method size() และ get(i)
        if (result && typeof result.size === 'function') {
            const arr = [];
            const count = result.size();
            for (let i = 0; i < count; i++) {
                arr.push(result.get(i));
            }
            return new Set(arr);
        }

        return new Set();
    }

    getObjectsInRect(x, y, width, height) {
        if (!this.isReady) return new Set();
        const result = this.wasmGrid.getObjectsInRect(x, y, width, height);

        if (result && typeof result.size === 'function') {
            const arr = [];
            const count = result.size();
            for (let i = 0; i < count; i++) {
                arr.push(result.get(i));
            }
            return new Set(arr);
        }

        return new Set();
    }

    getObjectsInRadius(centerX, centerY, radius, precision = null) {
        if (!this.isReady) return new Set();
        if (precision === null) {
            precision = this.RadiusPrecision?.CENTER || 1;
        }
        const result = this.wasmGrid.getObjectsInRadius(centerX, centerY, radius, precision);

        if (result && typeof result.size === 'function') {
            const arr = [];
            const count = result.size();
            for (let i = 0; i < count; i++) {
                arr.push(result.get(i));
            }
            return new Set(arr);
        }

        return new Set();
    }

    clear() {
        if (!this.isReady) return;
        this.wasmGrid.clear();
    }

    getCellCount() {
        if (!this.isReady) return 0;
        return this.wasmGrid.getCellCount();
    }

    getObjectCount() {
        if (!this.isReady) return 0;
        return this.wasmGrid.getObjectCount();
    }
}

// Fallback to pure JS if WASM fails
export class SpatialGridFallback {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.grid = new Map();
        this.objectData = new Map();

        this.RadiusPrecision = {
            SQUARE: 0,
            CENTER: 1,
            BOUNDS: 2
        };
    }

    getCellKey(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    addObject(id, x, y, width, height) {
        this.objectData.set(id, { x, y, width, height });

        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);

        for (let cellX = startX; cellX <= endX; cellX++) {
            for (let cellY = startY; cellY <= endY; cellY++) {
                const key = `${cellX},${cellY}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, new Set());
                }
                this.grid.get(key).add(id);
            }
        }
    }

    removeObject(id) {
        const data = this.objectData.get(id);
        if (!data) return;

        const { x, y, width, height } = data;
        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);

        for (let cellX = startX; cellX <= endX; cellX++) {
            for (let cellY = startY; cellY <= endY; cellY++) {
                const key = `${cellX},${cellY}`;
                const cell = this.grid.get(key);
                if (cell) {
                    cell.delete(id);
                    if (cell.size === 0) {
                        this.grid.delete(key);
                    }
                }
            }
        }

        this.objectData.delete(id);
    }

    updateObject(id, x, y, width, height) {
        this.removeObject(id);
        this.addObject(id, x, y, width, height);
    }

    getObjectsAt(x, y) {
        return this.grid.get(this.getCellKey(x, y)) || new Set();
    }

    clear() {
        this.grid.clear();
        this.objectData.clear();
    }

    getCellCount() {
        return this.grid.size;
    }

    getObjectCount() {
        return this.objectData.size;
    }
}

// Factory function with automatic fallback
export async function createSpatialGrid(cellSize = 100) {
    try {
        const wasmGrid = new SpatialGrid(cellSize);
        await wasmGrid.ensureReady();
        console.log('Using WASM SpatialGrid');
        return wasmGrid;
    } catch (error) {
        console.warn('WASM failed, using JS fallback:', error);
        return new SpatialGridFallback(cellSize);
    }
}