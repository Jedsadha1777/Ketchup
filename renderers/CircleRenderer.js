import { ObjectRenderer } from '../types/ObjectRenderer.js';

export class CircleRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.type === 'circle' && !obj.mapType;
    }

    getAvailableProperties(obj) {
        return ['color', 'label'];
    }
    
    draw(obj, ctx, view) {
        ctx.fillStyle = obj.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1 / view.zoom;
        
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const radius = Math.min(obj.width, obj.height) / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
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
        const radius = Math.min(obj.width, obj.height) / 2;
        const distance = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
        return distance <= radius;
    }
}