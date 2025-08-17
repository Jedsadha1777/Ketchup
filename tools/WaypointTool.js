import { ITool } from '../types/ITool.js';
import { MAP_OBJECT_STYLES } from '../map-editor/MapObjects.js';

export class WaypointTool extends ITool {
    constructor() {
        super('waypoint', 'Waypoint', { 
            icon: '📍',
            cursor: 'crosshair'
        });
    }

    activate(ctx) {
        ctx.updateCursor(this.cursor);
    }

    onPointerDown(e, pos, ctx) {
        // Single click waypoint
        const snapped = ctx.snapPosition(pos.x, pos.y);
        const r = MAP_OBJECT_STYLES.waypoint.radius;
        const color = MAP_OBJECT_STYLES.waypoint.color;
        
        // Use command for create
        const cmd = new ctx.createCommands.CreateObjectCmd(
            ctx.objects, ctx.spatialGrid, 'circle', snapped.x - r, snapped.y - r, r * 2, r * 2, color, 'waypoint'
        );
        const { id, index } = ctx.history.exec(cmd);

        ctx.objects.selectObject(index);
        ctx.updateInfo();
        ctx.updateInspector();
        ctx.updateClipboardButtons?.();
        ctx.render();
        ctx.updateHistoryButtons?.();
    }
}