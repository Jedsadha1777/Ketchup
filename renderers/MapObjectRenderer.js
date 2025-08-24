import { ObjectRenderer } from '../types/ObjectRenderer.js';
import { MAP_OBJECT_STYLES } from '../map-editor/MapObjects.js';

export class MapObjectRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.mapType && ['wall', 'corridor', 'room'].includes(obj.mapType);
    }

    getAvailableProperties(obj) {
        return ['label','rotation'];
    }
    
    draw(obj, ctx, view) {
        const style = MAP_OBJECT_STYLES[obj.mapType];
        
        ctx.save();
        ctx.globalAlpha = style.opacity ?? 1;
        ctx.fillStyle = style.color;
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth / view.zoom;
        
        // Check rotation
        const rotation = obj.extra?.rotation || 0;
        if (rotation !== 0) {
            const centerX = obj.x + obj.width / 2;
            const centerY = obj.y + obj.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-obj.width / 2, -obj.height / 2);
            ctx.fillRect(0, 0, obj.width, obj.height);
            ctx.strokeRect(0, 0, obj.width, obj.height);
        } else {
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        }
        
        ctx.restore();
        
        this.drawSelection(obj, ctx, view);
    }
    
    drawSelection(obj, ctx, view) {
        if (view.selected) {
            ctx.save();
            ctx.strokeStyle = '#0066cc';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
            const rotation = obj.extra?.rotation || 0;
            
            if (rotation !== 0) {
                const centerX = obj.x + obj.width / 2;
                const centerY = obj.y + obj.height / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.translate(-obj.width / 2, -obj.height / 2);
                ctx.strokeRect(0, 0, obj.width, obj.height);
            } else {
                ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            }
            
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    contains(obj, px, py) {
        const rotation = obj.extra?.rotation || 0;
        if (rotation === 0) {
            return px >= obj.x && px <= obj.x + obj.width &&
                   py >= obj.y && py <= obj.y + obj.height;
        }
        
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const rad = (-rotation * Math.PI) / 180;
        
        const localX = (px - centerX) * Math.cos(rad) - (py - centerY) * Math.sin(rad);
        const localY = (px - centerX) * Math.sin(rad) + (py - centerY) * Math.cos(rad);
        
        return localX >= -obj.width/2 && localX <= obj.width/2 &&
               localY >= -obj.height/2 && localY <= obj.height/2;
    }
}