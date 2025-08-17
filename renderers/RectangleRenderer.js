import { ObjectRenderer } from '../types/ObjectRenderer.js';

export class RectangleRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.type === 'rectangle' && !obj.mapType;
    }

    getAvailableProperties(obj) {
        return ['color', 'label'];
    }
    
    draw(obj, ctx, view) {
        ctx.fillStyle = obj.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1 / view.zoom;
        
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        
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
