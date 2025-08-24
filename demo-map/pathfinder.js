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
        const testPoints = this.objectSize < 5 ?
            [{ x: centerX, y: centerY }] :
            [
                { x: centerX - halfSize, y: centerY - halfSize },
                { x: centerX + halfSize, y: centerY - halfSize },
                { x: centerX - halfSize, y: centerY + halfSize },
                { x: centerX + halfSize, y: centerY + halfSize }
            ];

        return testPoints.every(point =>
            this.isPointInAnyCorridor(point.x, point.y)
        );
    }

    isPointInAnyCorridor(x, y) {
        for (const corridor of this.corridors) {
            if (!corridor.rotation || corridor.rotation === 0) {
                // ไม่มี rotation - เช็คปกติ
                if (x >= corridor.x && x <= corridor.x + corridor.width &&
                    y >= corridor.y && y <= corridor.y + corridor.height) {
                    return true;
                }
            } else {
                // มี rotation - transform point to local space
                const cx = corridor.x + corridor.width / 2;
                const cy = corridor.y + corridor.height / 2;
                const angle = -corridor.rotation * Math.PI / 180;

                const localX = (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx;
                const localY = (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy;

                if (localX >= corridor.x && localX <= corridor.x + corridor.width &&
                    localY >= corridor.y && localY <= corridor.y + corridor.height) {
                    return true;
                }
            }
        }
        return false;
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

        // คำนวณ bounds ที่แท้จริงรวม rotation
        this.corridors.forEach(corridor => {
            if (corridor.rotation && corridor.rotation !== 0) {
                // คำนวณมุมทั้ง 4 หลังหมุน
                const cx = corridor.x + corridor.width / 2;
                const cy = corridor.y + corridor.height / 2;
                const rad = corridor.rotation * Math.PI / 180;

                const corners = [
                    { x: corridor.x, y: corridor.y },
                    { x: corridor.x + corridor.width, y: corridor.y },
                    { x: corridor.x + corridor.width, y: corridor.y + corridor.height },
                    { x: corridor.x, y: corridor.y + corridor.height }
                ];

                corners.forEach(corner => {
                    const rx = cx + (corner.x - cx) * Math.cos(rad) - (corner.y - cy) * Math.sin(rad);
                    const ry = cy + (corner.x - cx) * Math.sin(rad) + (corner.y - cy) * Math.cos(rad);
                    minX = Math.min(minX, rx);
                    minY = Math.min(minY, ry);
                    maxX = Math.max(maxX, rx);
                    maxY = Math.max(maxY, ry);
                });
            } else {
                minX = Math.min(minX, corridor.x);
                minY = Math.min(minY, corridor.y);
                maxX = Math.max(maxX, corridor.x + corridor.width);
                maxY = Math.max(maxY, corridor.y + corridor.height);
            }
        });

        // Walls ไม่มี rotation
        this.walls.forEach(wall => {
            minX = Math.min(minX, wall.x);
            minY = Math.min(minY, wall.y);
            maxX = Math.max(maxX, wall.x + wall.width);
            maxY = Math.max(maxY, wall.y + wall.height);
        });

        // padding พอดี ไม่มากไป
        const padding = Math.max(50, this.objectSize * 2);

        return {
            minX: minX - padding,
            minY: minY - padding,
            width: maxX - minX + (padding * 2),
            height: maxY - minY + (padding * 2)
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
        const dirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1],  // 4 ทิศหลัก
            [-1, -1], [1, -1], [-1, 1], [1, 1]  // 4 ทิศทแยง
        ];

        return dirs
            .map(([dx, dy]) => {
                const neighbor = this.getNode(node.x + dx, node.y + dy);
                if (!neighbor || !neighbor.walkable) return null;

                // ถ้าเป็นการเดินทแยง ต้องเช็คว่าทางผ่านไม่ถูกบล็อก
                if (dx !== 0 && dy !== 0) {
                    const side1 = this.getNode(node.x + dx, node.y);
                    const side2 = this.getNode(node.x, node.y + dy);
                    if (!side1?.walkable || !side2?.walkable) return null;
                }

                return neighbor;
            })
            .filter(neighbor => neighbor !== null);

    }

    heuristic(a, b) {
        // ใช้ Euclidean distance แทน Manhattan
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return Math.sqrt(dx * dx + dy * dy);
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
                const optimized = this.optimizePath(path.reverse());
                return this.smoothPath(optimized); 
            }

            this.getNeighbors(current).forEach(neighbor => {
                if (closedSet.has(neighbor)) return;

                // คำนวณ cost - ทแยงมีค่ามากกว่า
                const dx = Math.abs(neighbor.x - current.x);
                const dy = Math.abs(neighbor.y - current.y);
                const isDiagonal = dx !== 0 && dy !== 0;
                let moveCost = isDiagonal ? Math.sqrt(2) : 1;

                // ยังคง bias ไปทางเป้าหมาย
                const toEndX = endNode.x - current.x;
                const toEndY = endNode.y - current.y;
                const moveX = neighbor.x - current.x;
                const moveY = neighbor.y - current.y;

                if ((toEndX > 0 && moveX > 0) || (toEndX < 0 && moveX < 0) ||
                    (toEndY > 0 && moveY > 0) || (toEndY < 0 && moveY < 0)) {
                    moveCost *= 0.99;
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

    smoothPath(path) {
        if (path.length <= 2) return path;
        
        const smoothed = [path[0]];
        let current = 0;
        
        while (current < path.length - 1) {
            // ลองข้ามไปจุดสุดท้ายเลย
            if (current < path.length - 2 && 
                this.canDrawDirectLine(path[current], path[path.length - 1])) {
                smoothed.push(path[path.length - 1]);
                break;
            }
            
            // หาจุดไกลสุด
            let furthest = current + 1;
            for (let i = path.length - 1; i > current + 1; i--) {
                if (this.canDrawDirectLine(path[current], path[i])) {
                    furthest = i;
                    break;
                }
            }
            
            smoothed.push(path[furthest]);
            current = furthest;
        }
        
        return smoothed;
    }

    canDrawDirectLine(from, to) {
        const steps = 50;  // เพิ่มจาก 20 เป็น 50
        const halfSize = this.objectSize / 2;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            
            // เช็คทั้ง center และขอบของ object
            const testPoints = [
                {x: x, y: y},
                {x: x - halfSize, y: y - halfSize},
                {x: x + halfSize, y: y - halfSize},
                {x: x - halfSize, y: y + halfSize},
                {x: x + halfSize, y: y + halfSize}
            ];
            
            for (const point of testPoints) {
                if (!this.isPointInAnyCorridor(point.x, point.y) || 
                    !this.isPositionClearOfWalls(x, y)) {
                    return false;
                }
            }
        }
        return true;
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