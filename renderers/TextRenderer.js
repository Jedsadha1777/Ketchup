import { ObjectRenderer } from '../types/ObjectRenderer.js';

export class TextRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.type === 'text';
    }

    getAvailableProperties(obj) {
        return ['color', 'label', 'fontSize', 'fontFamily', 'textAlign', 'text'];
    }
    
    draw(obj, ctx, view) {
        const extra = obj.extra;
        if (!extra || !extra.text) {
            this.drawPlaceholder(obj, ctx, view);
            return;
        }

        ctx.save();
        
        // Set font properties
        ctx.font = `${extra.fontStyle || 'normal'} ${extra.fontWeight || 'normal'} ${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;
        ctx.fillStyle = obj.color;
        ctx.textAlign = extra.textAlign || 'left';
        ctx.textBaseline = extra.textBaseline || 'top';
        
        // Calculate position with padding
        const padding = extra.padding || 4;
        let textX = obj.x + padding;
        let textY = obj.y + padding;
        
        // Adjust X position based on text alignment
        if (extra.textAlign === 'center') {
            textX = obj.x + obj.width / 2;
        } else if (extra.textAlign === 'right') {
            textX = obj.x + obj.width - padding;
        }
        
        // Draw text lines
        const lines = extra.text.split('\n');
        const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
        
        for (let i = 0; i < lines.length; i++) {
            const y = textY + (i * lineHeight);
            ctx.fillText(lines[i], textX, y);
        }
        
        ctx.restore();
        
        this.drawSelection(obj, ctx, view);
    }
    
    drawPlaceholder(obj, ctx, view) {
        // Draw placeholder for empty text
        ctx.save();
        ctx.fillStyle = '#ccc';
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1 / view.zoom;
        ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
        
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        
        // Draw "Text" placeholder
        ctx.font = `${14 / view.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Text', obj.x + obj.width/2, obj.y + obj.height/2);
        
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
        // Standard rectangle hit test
        return px >= obj.x && px <= obj.x + obj.width &&
               py >= obj.y && py <= obj.y + obj.height;
    }
}