import { ObjectRenderer } from '../types/ObjectRenderer.js';
import { MAP_OBJECT_STYLES } from '../map-editor/MapObjects.js';

export class WaypointRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.mapType === 'waypoint';
    }

    getAvailableProperties(obj) {
        return ['label'];
    }
    
    draw(obj, ctx, view) {
        const style = MAP_OBJECT_STYLES.waypoint;
        
        ctx.save();
        ctx.globalAlpha = style.opacity ?? 1;
        ctx.fillStyle = style.color;
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth / view.zoom;
        
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, style.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
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
    
    contains(obj, px, py) {
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const radius = MAP_OBJECT_STYLES.waypoint.radius;
        const distance = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
        return distance <= radius;
    }
}