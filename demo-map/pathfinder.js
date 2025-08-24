// =============================================================================
// PATHFINDING CLASS
// =============================================================================
export class OrthogonalPathfinder {
    constructor(corridors, walls, gridSize, objectSize = 20) {
        this.corridors = corridors;
        this.walls = walls;
        this.gridSize = gridSize;
        this.objectSize = objectSize;
        this.createGrid();
    }

    createGrid() {
        const bounds = this.getMapBounds();
        const cols = Math.ceil(bounds.width / this.gridSize);
        const rows = Math.ceil(bounds.height / this.gridSize);

        this.grid = [];
        this.minX = bounds.minX;
        this.minY = bounds.minY;
        this.cols = cols;
        this.rows = rows;

        for (let y = 0; y < rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < cols; x++) {
                const worldX = this.minX + x * this.gridSize + this.gridSize / 2;
                const worldY = this.minY + y * this.gridSize + this.gridSize / 2;
                const walkable = this.canPlaceObjectAt(worldX, worldY);

                this.grid[y][x] = {
                    x, y, worldX, worldY, walkable,
                    f: 0, g: 0, h: 0, parent: null
                };
            }
        }

        const walkableCount = this.grid.flat().filter(cell => cell.walkable).length;
        console.log(`Walkable cells: ${walkableCount}/${cols * rows}`);
    }

    canPlaceObjectAt(centerX, centerY) {
        if (!this.isPositionClearOfWalls(centerX, centerY)) return false;

        const halfSize = this.objectSize / 2;
        if (this.objectSize < 5) {
            return this.corridors.some(corridor =>
                centerX >= corridor.x && centerX <= corridor.x + corridor.width &&
                centerY >= corridor.y && centerY <= corridor.y + corridor.height
            );
        }

        const corners = [
            { x: centerX - halfSize, y: centerY - halfSize },
            { x: centerX + halfSize, y: centerY - halfSize },
            { x: centerX - halfSize, y: centerY + halfSize },
            { x: centerX + halfSize, y: centerY + halfSize }
        ];

        return corners.every(corner =>
            this.corridors.some(corridor =>
                corner.x >= corridor.x && corner.x <= corridor.x + corridor.width &&
                corner.y >= corridor.y && corner.y <= corridor.y + corridor.height
            )
        );
    }

    isPositionClearOfWalls(centerX, centerY) {
        const halfSize = this.objectSize / 2;
        const objectBounds = {
            left: centerX - halfSize,
            right: centerX + halfSize,
            top: centerY - halfSize,
            bottom: centerY + halfSize
        };

        return !this.walls.some(wall => {
            const wallBounds = {
                left: wall.x,
                right: wall.x + wall.width,
                top: wall.y,
                bottom: wall.y + wall.height
            };

            return objectBounds.left < wallBounds.right &&
                objectBounds.right > wallBounds.left &&
                objectBounds.top < wallBounds.bottom &&
                objectBounds.bottom > wallBounds.top;
        });
    }

    getMapBounds() {
        const allObjects = [...this.corridors, ...this.walls];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        allObjects.forEach(obj => {
            minX = Math.min(minX, obj.x);
            minY = Math.min(minY, obj.y);
            maxX = Math.max(maxX, obj.x + obj.width);
            maxY = Math.max(maxY, obj.y + obj.height);
        });

        return {
            minX: minX - this.gridSize * 2,
            minY: minY - this.gridSize * 2,
            width: maxX - minX + this.gridSize * 4,
            height: maxY - minY + this.gridSize * 4
        };
    }

    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor((worldX - this.minX + this.gridSize / 2) / this.gridSize),
            y: Math.floor((worldY - this.minY + this.gridSize / 2) / this.gridSize)
        };
    }

    getNode(x, y) {
        return (x >= 0 && x < this.cols && y >= 0 && y < this.rows) ? this.grid[y][x] : null;
    }

    getNeighbors(node) {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        return dirs
            .map(([dx, dy]) => this.getNode(node.x + dx, node.y + dy))
            .filter(neighbor => neighbor && neighbor.walkable);
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    findPath(startWorld, endWorld) {
        if (!this.canPlaceObjectAt(startWorld.x, startWorld.y) ||
            !this.canPlaceObjectAt(endWorld.x, endWorld.y)) {
            console.log('Cannot place object at start or end waypoint');
            return null;
        }

        const start = this.worldToGrid(startWorld.x, startWorld.y);
        const end = this.worldToGrid(endWorld.x, endWorld.y);
        const startNode = this.getNode(start.x, start.y);
        const endNode = this.getNode(end.x, end.y);

        if (!startNode?.walkable || !endNode?.walkable) {
            console.log('Start or end node not walkable');
            return null;
        }

        this.grid.flat().forEach(node => {
            node.f = node.g = node.h = 0;
            node.parent = null;
        });

        const openSet = [startNode];
        const closedSet = new Set();

        startNode.g = 0;
        startNode.h = this.heuristic(startNode, endNode);
        startNode.f = startNode.h;

        while (openSet.length > 0) {
            let current = openSet[0];
            let currentIndex = 0;

            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < current.f ||
                    (openSet[i].f === current.f && openSet[i].h < current.h)) {
                    current = openSet[i];
                    currentIndex = i;
                }
            }

            openSet.splice(currentIndex, 1);
            closedSet.add(current);

            if (current === endNode) {
                const path = [];
                let temp = current;
                while (temp) {
                    path.push({ x: temp.worldX, y: temp.worldY });
                    temp = temp.parent;
                }
                return this.optimizePath(path.reverse());
            }

            this.getNeighbors(current).forEach(neighbor => {
                if (closedSet.has(neighbor)) return;

                let moveCost = 1;
                const toEndX = endNode.x - current.x;
                const toEndY = endNode.y - current.y;
                const moveX = neighbor.x - current.x;
                const moveY = neighbor.y - current.y;

                if ((toEndX > 0 && moveX > 0) || (toEndX < 0 && moveX < 0) ||
                    (toEndY > 0 && moveY > 0) || (toEndY < 0 && moveY < 0)) {
                    moveCost = 0.99;
                }

                const tentativeG = current.g + moveCost;

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                } else if (tentativeG >= neighbor.g) {
                    return;
                }

                neighbor.parent = current;
                neighbor.g = tentativeG;
                neighbor.h = this.heuristic(neighbor, endNode);
                neighbor.f = neighbor.g + neighbor.h;
            });
        }

        console.log('No path found');
        return null;
    }

    optimizePath(path) {
        if (path.length <= 2) return path;

        const simplified = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const next = path[i + 1];

            const dir1 = {
                x: Math.sign(curr.x - prev.x),
                y: Math.sign(curr.y - prev.y)
            };
            const dir2 = {
                x: Math.sign(next.x - curr.x),
                y: Math.sign(next.y - curr.y)
            };

            if (dir1.x !== dir2.x || dir1.y !== dir2.y) {
                simplified.push(curr);
            }
        }
        simplified.push(path[path.length - 1]);
        return simplified;
    }
}


export function lineIntersectsWalls(point1, point2, walls) {
    const samples = 20;
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const checkX = point1.x + (point2.x - point1.x) * t;
        const checkY = point1.y + (point2.y - point1.y) * t;
        
        if (walls.some(wall =>
            checkX >= wall.x && checkX <= wall.x + wall.width &&
            checkY >= wall.y && checkY <= wall.y + wall.height
        )) {
            return true;
        }
    }
    return false;
}