import { ITool } from '../types/ITool.js';
import { MAP_OBJECT_STYLES } from '../map-editor/MapObjects.js';

export class WarpPointTool extends ITool {
    constructor() {
        super('warppoint', 'Warp Point', { 
            icon: '🌀',
            cursor: 'crosshair'
        });
    }

    activate(ctx) {
        ctx.updateCursor(this.cursor);
    }

    onPointerDown(e, pos, ctx) {
        // Single click warp point
        const snapped = ctx.snapPosition(pos.x, pos.y);
        const r = MAP_OBJECT_STYLES.warppoint.radius;
        const color = MAP_OBJECT_STYLES.warppoint.color;
        
        // Use command for create
        const cmd = new ctx.createCommands.CreateObjectCmd(
            ctx.objects, ctx.spatialGrid, 'circle', snapped.x - r, snapped.y - r, r * 2, r * 2, color, 'warppoint'
        );
        const { id, index } = ctx.history.exec(cmd);

        // Set default portalId in extra property
        ctx.objects.extra[index] = { portalId: '' };
        
        ctx.objects.selectObject(index);
        ctx.updateInfo();
        ctx.updateInspector();
        ctx.updateClipboardButtons?.();
        ctx.render();
        ctx.updateHistoryButtons?.();
    }
}