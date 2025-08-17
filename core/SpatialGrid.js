export class SpatialGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    getCellKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    addObject(id, x, y, width, height) {
        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);

        for (let cellX = startX; cellX <= endX; cellX++) {
            for (let cellY = startY; cellY <= endY; cellY++) {
                const key = `${cellX},${cellY}`;
                if (!this.grid.has(key)) this.grid.set(key, new Set());
                this.grid.get(key).add(id);
            }
        }
    }

    removeObject(id, x, y, width, height) {
        const startX = Math.floor(x / this.cellSize);
        const startY = Math.floor(y / this.cellSize);
        const endX = Math.floor((x + width) / this.cellSize);
        const endY = Math.floor((y + height) / this.cellSize);

        for (let cellX = startX; cellX <= endX; cellX++) {
            for (let cellY = startY; cellY <= endY; cellY++) {
                const key = `${cellX},${cellY}`;
                if (this.grid.has(key)) {
                    this.grid.get(key).delete(id);
                    if (this.grid.get(key).size === 0) this.grid.delete(key);
                }
            }
        }
    }

    getObjectsAt(x, y) {
        return this.grid.get(this.getCellKey(x, y)) || new Set();
    }

    clear() {
        this.grid.clear();
    }

    getCellCount() { 
        return this.grid.size; 
    }
}