import { OrthogonalPathfinder } from './pathfinder.js';
import { createStraightLinePath } from './pathfinding-utils.js';

// =============================================================================
// RENDERING FUNCTIONS
// =============================================================================
export function drawPaths(AppState, Config) {
    if (AppState.corridors.length === 0) return;

    const ctx = AppState.viewer.ctx;
    ctx.save();
    ctx.scale(AppState.viewer.zoom, AppState.viewer.zoom);
    ctx.translate(AppState.viewer.panX / AppState.viewer.zoom, AppState.viewer.panY / AppState.viewer.zoom);

    AppState.paths.forEach((path, index) => {
        const hue = (index * 137.5) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;

        // Draw main path
        ctx.strokeStyle = color;
        ctx.lineWidth = AppState.objectSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        path.points.forEach((point, i) => {
            if (i === 0 || (path.points.teleportSegments && path.points.teleportSegments.includes(i - 1))) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();

        // Draw markers
        ctx.fillStyle = color;
        const markerSize = AppState.objectSize / 2;
        ctx.fillRect(path.points[0].x - markerSize, path.points[0].y - markerSize, markerSize * 2, markerSize * 2);
        ctx.fillRect(path.points[path.points.length - 1].x - markerSize, path.points[path.points.length - 1].y - markerSize, markerSize * 2, markerSize * 2);
    });

    ctx.restore();

    // Draw adjustment indicators
    AppState.paths.forEach((path, index) => {
        const hue = (index * 137.5) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;

        if (path.fromOriginal && path.fromAdjusted) {
            drawAdjustmentIndicator(AppState, Config, path.fromOriginal, path.fromAdjusted, color);
        }
        if (path.toOriginal && path.toAdjusted) {
            drawAdjustmentIndicator(AppState, Config, path.toOriginal, path.toAdjusted, color);
        }
    });
}

export function drawAdjustmentIndicator(AppState, Config, original, adjusted, color) {
    const ctx = AppState.viewer.ctx;
    const distance = Math.sqrt(
        Math.pow(original.x - adjusted.x, 2) +
        Math.pow(original.y - adjusted.y, 2)
    );

    if (distance <= 1) return;

    ctx.save();
    ctx.scale(AppState.viewer.zoom, AppState.viewer.zoom);
    ctx.translate(AppState.viewer.panX / AppState.viewer.zoom, AppState.viewer.panY / AppState.viewer.zoom);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / AppState.viewer.zoom;
    ctx.setLineDash([3 / AppState.viewer.zoom, 3 / AppState.viewer.zoom]);

    // Use refactored straight line logic
    const linePath = createStraightLinePath(original, adjusted, AppState.walls);

    if (linePath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(linePath[0].x, linePath[0].y);
        for (let i = 1; i < linePath.length; i++) {
            ctx.lineTo(linePath[i].x, linePath[i].y);
        }
        ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw start and end points
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / AppState.viewer.zoom;

    ctx.beginPath();
    ctx.arc(original.x, original.y, 3 / AppState.viewer.zoom, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(adjusted.x, adjusted.y, 3 / AppState.viewer.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

export function drawCorridorBuffers(AppState, Config) {
    const ctx = AppState.viewer.ctx;
    const halfSize = AppState.objectSize / 2;

    ctx.save();
    ctx.scale(AppState.viewer.zoom, AppState.viewer.zoom);
    ctx.translate(AppState.viewer.panX / AppState.viewer.zoom, AppState.viewer.panY / AppState.viewer.zoom);

    if (AppState.showCorridors) {
        // Draw corridors (yellow)
        ctx.fillStyle = Config.styles.debug.corridorFill;
        AppState.corridors.forEach(corridor => {
            if (corridor.rotation && corridor.rotation !== 0) {
                ctx.save();
                const cx = corridor.x + corridor.width / 2;
                const cy = corridor.y + corridor.height / 2;
                ctx.translate(cx, cy);
                ctx.rotate(corridor.rotation * Math.PI / 180);
                ctx.fillRect(-corridor.width / 2, -corridor.height / 2, corridor.width, corridor.height);
                ctx.restore();
            } else {
                ctx.fillRect(corridor.x, corridor.y, corridor.width, corridor.height);
            }
        });

        // Draw safe area (green)
        ctx.fillStyle = Config.styles.debug.safeAreaFill;
        AppState.corridors.forEach(corridor => {
            const safeWidth = corridor.width - AppState.objectSize;
            const safeHeight = corridor.height - AppState.objectSize;

            if (safeWidth > 0 && safeHeight > 0) {
                if (corridor.rotation && corridor.rotation !== 0) {
                    ctx.save();
                    const cx = corridor.x + corridor.width / 2;
                    const cy = corridor.y + corridor.height / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate(corridor.rotation * Math.PI / 180);
                    ctx.fillRect(-safeWidth / 2, -safeHeight / 2, safeWidth, safeHeight);
                    ctx.restore();
                } else {
                    ctx.fillRect(
                        corridor.x + halfSize,
                        corridor.y + halfSize,
                        safeWidth,
                        safeHeight
                    );
                }
            }
        });

        // Draw grid points
        const pathfinder = new OrthogonalPathfinder(AppState.corridors, AppState.walls, AppState.gridSize, AppState.objectSize);
        ctx.fillStyle = Config.styles.debug.gridPointFill;

        for (let y = 0; y < pathfinder.rows; y++) {
            for (let x = 0; x < pathfinder.cols; x++) {
                if (pathfinder.grid[y][x].walkable) {
                    const worldX = pathfinder.grid[y][x].worldX;
                    const worldY = pathfinder.grid[y][x].worldY;
                    ctx.beginPath();
                    ctx.arc(worldX, worldY, 2 / AppState.viewer.zoom, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    if (AppState.showWalls) {
        ctx.fillStyle = Config.styles.debug.wallFill;
        AppState.walls.forEach(wall => {
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        });
    }

    if (AppState.showWaypoints) {
        const pathfinder = new OrthogonalPathfinder(AppState.corridors, AppState.walls, AppState.gridSize, AppState.objectSize);
        ctx.lineWidth = 1 / AppState.viewer.zoom;

        AppState.waypoints.forEach(waypoint => {
            const canPlace = pathfinder.canPlaceObjectAt(waypoint.x, waypoint.y);

            ctx.fillStyle = canPlace ? Config.styles.debug.validWaypointFill : Config.styles.debug.invalidWaypointFill;
            ctx.strokeStyle = canPlace ? Config.styles.debug.validWaypointStroke : Config.styles.debug.invalidWaypointStroke;

            ctx.fillRect(waypoint.x - halfSize, waypoint.y - halfSize, AppState.objectSize, AppState.objectSize);
            ctx.strokeRect(waypoint.x - halfSize, waypoint.y - halfSize, AppState.objectSize, AppState.objectSize);

            if (!canPlace) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3 / AppState.viewer.zoom;
                ctx.beginPath();
                ctx.moveTo(waypoint.x - halfSize + 2, waypoint.y - halfSize + 2);
                ctx.lineTo(waypoint.x + halfSize - 2, waypoint.y + halfSize - 2);
                ctx.moveTo(waypoint.x + halfSize - 2, waypoint.y - halfSize + 2);
                ctx.lineTo(waypoint.x - halfSize + 2, waypoint.y + halfSize - 2);
                ctx.stroke();
            }

            ctx.fillStyle = Config.styles.debug.waypointCenterFill;
            ctx.beginPath();
            ctx.arc(waypoint.x, waypoint.y, 3 / AppState.viewer.zoom, 0, Math.PI * 2);
            ctx.fill();

            // Draw waypoint label
            ctx.fillStyle = Config.styles.debug.labelColor;
            ctx.font = Config.styles.fonts.waypointLabel.replace('12px', `${12 / AppState.viewer.zoom}px`);
            let displayText = '';
            if (waypoint.type === 'warppoint' && waypoint.portalId) {
                displayText = waypoint.label ? waypoint.label : waypoint.portalId;
            } else if (waypoint.label) {
                displayText = waypoint.label;
            } else {
                displayText = waypoint.id;
            }

            ctx.fillText(displayText, waypoint.x + halfSize + 5, waypoint.y - halfSize - 5);
        });
    }

    ctx.restore();
}


// =============================================================================
// WARPPOINT RENDERING
// =============================================================================
export function drawWarppoints(AppState, Config) {
    if (!AppState.showWarppoints) return;

    const ctx = AppState.viewer.ctx;
    ctx.save();
    ctx.scale(AppState.viewer.zoom, AppState.viewer.zoom);
    ctx.translate(AppState.viewer.panX / AppState.viewer.zoom, AppState.viewer.panY / AppState.viewer.zoom);

    AppState.waypoints.forEach(waypoint => {
        if (waypoint.type !== 'warppoint') return;

        const radius = Config.defaults.warpointRadius;

        ctx.fillStyle = Config.styles.warppoint.fillColor;
        ctx.strokeStyle = Config.styles.warppoint.strokeColor;
        ctx.lineWidth = 2 / AppState.viewer.zoom;

        ctx.beginPath();
        ctx.arc(waypoint.x, waypoint.y, radius, 0, Math.PI * 2);

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = Config.styles.warppoint.innerFillColor;
        ctx.beginPath();
        ctx.arc(waypoint.x, waypoint.y, radius * 0.5, 0, Math.PI * 2);

        ctx.fill();
    });

    ctx.restore();
}

export function drawWaypointLabels(AppState, Config) {
    const ctx = AppState.viewer.ctx;

    ctx.save();
    ctx.scale(AppState.viewer.zoom, AppState.viewer.zoom);
    ctx.translate(AppState.viewer.panX / AppState.viewer.zoom, AppState.viewer.panY / AppState.viewer.zoom);

    AppState.waypoints.forEach(waypoint => {
        // Skip if hidden by visibility settings
        if (waypoint.type === 'warppoint' && !AppState.showWarppoints) return;
        if (waypoint.type === 'waypoint' && !AppState.showWaypoints) return;

        ctx.fillStyle = Config.styles.debug.labelColor;
        ctx.font = Config.styles.fonts.waypointLabel.replace('12px', `${12 / AppState.viewer.zoom}px`);

        let displayText = '';
        if (waypoint.type === 'warppoint' && waypoint.portalId) {
            displayText = waypoint.label ?
                `${waypoint.label}` : `${waypoint.portalId}`;
        } else if (waypoint.label) {
            displayText = waypoint.label;
        } else {
            displayText = waypoint.id;
        }

        if (displayText) {
            ctx.fillText(displayText, waypoint.x + 10 / AppState.viewer.zoom, waypoint.y - 10 / AppState.viewer.zoom);
        }
    });

    ctx.restore();
}

// =============================================================================
// TEMP WAYPOINT RENDERING
// =============================================================================
export function drawTempWaypoints(AppState, Config) {
    const ctx = AppState.viewer.ctx;

    ctx.save();
    ctx.scale(AppState.viewer.zoom, AppState.viewer.zoom);
    ctx.translate(AppState.viewer.panX / AppState.viewer.zoom, AppState.viewer.panY / AppState.viewer.zoom);

    // Draw FROM point
    if (AppState.tempFromPoint) {
        const point = AppState.tempFromPoint;

        // Green circle for FROM
        ctx.fillStyle = Config.styles.fromMarker.fillColor;
        ctx.strokeStyle = Config.styles.fromMarker.strokeColor;
        ctx.lineWidth = 2 / AppState.viewer.zoom;

        ctx.beginPath();
        ctx.arc(point.x, point.y, Config.defaults.markerRadius / AppState.viewer.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // White "F" text
        ctx.fillStyle = 'white';
        ctx.font = Config.styles.fonts.markerLabel.replace('10px', `${10 / AppState.viewer.zoom}px`);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F', point.x, point.y);

        // Label
        ctx.fillStyle = Config.styles.fromMarker.labelColor;
        ctx.font = `${11 / AppState.viewer.zoom}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('FROM', point.x + 12 / AppState.viewer.zoom, point.y - 12 / AppState.viewer.zoom);
    }

    // Draw TO point
    if (AppState.tempToPoint) {
        const point = AppState.tempToPoint;

        // Red circle for TO
        ctx.fillStyle = Config.styles.toMarker.fillColor;
        ctx.strokeStyle = Config.styles.toMarker.strokeColor;
        ctx.lineWidth = 2 / AppState.viewer.zoom;

        ctx.beginPath();
        ctx.arc(point.x, point.y, Config.defaults.markerRadius / AppState.viewer.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // White "T" text
        ctx.fillStyle = 'white';
        ctx.font = Config.styles.fonts.markerLabel.replace('10px', `${10 / AppState.viewer.zoom}px`);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('T', point.x, point.y);

        // Label
        ctx.fillStyle = Config.styles.toMarker.labelColor;
        ctx.font = `${11 / AppState.viewer.zoom}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('TO', point.x + 12 / AppState.viewer.zoom, point.y - 12 / AppState.viewer.zoom);
    }

    ctx.restore();
}