import { ObjectRenderer } from '../types/ObjectRenderer.js';
import { MAP_OBJECT_STYLES } from '../map-editor/MapObjects.js';

export class MapObjectRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.mapType && ['wall', 'corridor', 'room'].includes(obj.mapType);
    }

    getAvailableProperties(obj) {
        return ['label'];
    }
    
    draw(obj, ctx, view) {
        const style = MAP_OBJECT_STYLES[obj.mapType];
        
        ctx.save();
        ctx.globalAlpha = style.opacity ?? 1;
        ctx.fillStyle = style.color;
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth / view.zoom;
        
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        
        ctx.restore();
        
        this.drawSelection(obj, ctx, view);
    }
    
    drawSelection(obj, ctx, view) {
        if (view.selected) {
            ctx.strokeStyle = '#0066cc';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
            ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            ctx.setLineDash([]);
        }
    }
}