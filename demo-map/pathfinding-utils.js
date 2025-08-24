import { OrthogonalPathfinder, lineIntersectsWalls } from './pathfinder.js';

export function findNearestCorridorPosition(waypoint, corridors, walls, gridSize, objectSize) {
    if (corridors.length === 0) return waypoint;

    const pathfinder = new OrthogonalPathfinder(corridors, walls, gridSize, objectSize);
    let nearestPos = waypoint;
    let minDistance = Infinity;
    const margin = objectSize + Math.max(objectSize * 0.5, objectSize * 0.3);

    for (const corridor of corridors) {
        if (corridor.width < margin * 2 || corridor.height < margin * 2) {
            continue;
        }

        const edges = [
            {
                x: Math.max(corridor.x + margin, Math.min(corridor.x + corridor.width - margin, waypoint.x)),
                y: corridor.y + margin
            },
            {
                x: Math.max(corridor.x + margin, Math.min(corridor.x + corridor.width - margin, waypoint.x)),
                y: corridor.y + corridor.height - margin
            },
            {
                x: corridor.x + margin,
                y: Math.max(corridor.y + margin, Math.min(corridor.y + corridor.height - margin, waypoint.y))
            },
            {
                x: corridor.x + corridor.width - margin,
                y: Math.max(corridor.y + margin, Math.min(corridor.y + corridor.height - margin, waypoint.y))
            }
        ];

        for (const edge of edges) {
            if (pathfinder.canPlaceObjectAt(edge.x, edge.y)) {
                const distance = Math.sqrt(
                    Math.pow(waypoint.x - edge.x, 2) +
                    Math.pow(waypoint.y - edge.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPos = edge;
                }
            }
        }
    }

    return nearestPos;
}

export function findPortalPath(fromPos, toPos, pathfinder, waypoints) {
    const queue = [{ pos: fromPos, path: [], visitedPortals: new Set(), teleportSegments: [] }];
    const visited = new Set();
    
    while (queue.length > 0) {
        const { pos, path, visitedPortals, teleportSegments } = queue.shift();
        
        const directPath = pathfinder.findPath(pos, toPos);
        if (directPath) {
            const finalPath = [...path, ...directPath];
            finalPath.teleportSegments = teleportSegments;
            return finalPath;
        }
        
        // หา warppoints ที่เข้าถึงได้
        const reachableWarps = waypoints.filter(w => 
            w.type === 'warppoint' && 
            w.portalId && 
            !visitedPortals.has(w.id) &&
            pathfinder.findPath(pos, w)
        );

        // เรียงตามระยะทางจากตำแหน่งปัจจุบัน
        reachableWarps.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(pos.x - a.x, 2) + Math.pow(pos.y - a.y, 2));
            const distB = Math.sqrt(Math.pow(pos.x - b.x, 2) + Math.pow(pos.y - b.y, 2));
            return distA - distB;
        });

        
        for (const warp1 of reachableWarps) {
            const warp2Options = waypoints.filter(w => 
                w.type === 'warppoint' && 
                w.portalId === warp1.portalId && 
                w.id !== warp1.id &&
                !visitedPortals.has(w.id)
            );
            
            for (const warp2 of warp2Options) {
                const pathToWarp1 = pathfinder.findPath(pos, warp1);
                if (pathToWarp1) {
                    const newVisited = new Set([...visitedPortals, warp1.id, warp2.id]);
                    const newPath = [...path, ...pathToWarp1, warp2];
                    const newTeleportSegments = [...teleportSegments, newPath.length - 2];
                    const stateKey = `${warp2.x},${warp2.y}`;
                    
                    if (!visited.has(stateKey)) {
                        visited.add(stateKey);
                        queue.push({ 
                            pos: warp2, 
                            path: newPath, 
                            visitedPortals: newVisited,
                            teleportSegments: newTeleportSegments
                        });
                    }
                }
            }
        }
    }
    
    return null;
}

export function createStraightLinePath(original, adjusted, walls) {
    if (!original || !adjusted) return [];

    const distance = Math.sqrt(
        Math.pow(original.x - adjusted.x, 2) +
        Math.pow(original.y - adjusted.y, 2)
    );

    if (distance <= 1) return [];

    const deltaX = adjusted.x - original.x;
    const deltaY = adjusted.y - original.y;
    const sameX = Math.abs(deltaX) < 1;
    const sameY = Math.abs(deltaY) < 1;

    if (sameX && sameY) {
        return [];
    } else if (sameX || sameY) {
        return !lineIntersectsWalls(original, adjusted, walls) ? [original, adjusted] : [];
    } else {
        const midPoint1 = { x: adjusted.x, y: original.y };
        const midPoint2 = { x: original.x, y: adjusted.y };
        const path1Valid = !lineIntersectsWalls(original, midPoint1, walls) && 
                          !lineIntersectsWalls(midPoint1, adjusted, walls);
        const path2Valid = !lineIntersectsWalls(original, midPoint2, walls) && 
                          !lineIntersectsWalls(midPoint2, adjusted, walls);

        if (path1Valid && path2Valid) {
            const useHorizontalFirst = Math.abs(deltaX) >= Math.abs(deltaY);
            return useHorizontalFirst ? [original, midPoint1, adjusted] : [original, midPoint2, adjusted];
        } else if (path1Valid) {
            return [original, midPoint1, adjusted];
        } else if (path2Valid) {
            return [original, midPoint2, adjusted];
        }
    }

    return [];
}