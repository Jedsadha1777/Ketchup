import { ObjectRenderer } from '../types/ObjectRenderer.js';
import { TextUtils } from '../utils/TextUtils.js';


export class TextRenderer extends ObjectRenderer {
    canRender(obj) {
        return obj.type === 'text';
    }

    getAvailableProperties(obj) {
        return ['color', 'label', 'fontSize', 'fontFamily', 'textAlign', 'text', 'rotation'];
    }
    
    draw(obj, ctx, view) {
        const extra = obj.extra;
        if (!extra || !extra.text) {
            this.drawPlaceholder(obj, ctx, view);
            return;
        }

        ctx.save();

        // Apply rotation
        const rotation = extra.rotation || 0;
        if (rotation !== 0) {
            const centerX = obj.x + obj.width / 2;
            const centerY = obj.y + obj.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-obj.width / 2, -obj.height / 2);
            // ลบบรรทัดนี้ออก: obj = { ...obj, x: 0, y: 0 };
        }
        
        // Set font properties
        ctx.font = `${extra.fontStyle || 'normal'} ${extra.fontWeight || 'normal'} ${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;
        ctx.fillStyle = obj.color;
        ctx.textAlign = extra.textAlign || 'left';
        ctx.textBaseline = extra.textBaseline || 'top';

        const padding = extra.padding || 4;
        // ใช้ coordinates ที่ถูกต้องตามสถานะ rotation
        const drawX = rotation !== 0 ? 0 : obj.x;
        const drawY = rotation !== 0 ? 0 : obj.y;
        const bounds = { x: drawX, y: drawY, width: obj.width, height: obj.height };
    
        // Always wrap text to prevent side overflow
        const maxWidth = Math.max(bounds.width - (padding * 2), 20);
        const lines = TextUtils.wrapTextToLines(extra.text, maxWidth, ctx);

        let textX = drawX + padding;
        let textY = drawY + padding;
        
        // Adjust X position based on text alignment
        if (extra.textAlign === 'center') {
            textX = drawX + obj.width / 2;
        } else if (extra.textAlign === 'right') {
            textX = drawX + obj.width - padding;
        }
        
        // Draw text lines
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

        // Clip placeholder too
       

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
            const extra = obj.extra;
            if (!extra || !extra.text) {
                return px >= obj.x && px <= obj.x + obj.width &&
                       py >= obj.y && py <= obj.y + obj.height;
            }
            
            const padding = extra.padding || 4;
            const maxWidth = Math.max(obj.width - (padding * 2), 20);
            const lines = this.countLines(extra.text, maxWidth);
            const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
            const actualHeight = lines * lineHeight + (padding * 2);
            
             return px >= obj.x && px <= obj.x + obj.width &&
                   py >= obj.y && py <= obj.y + actualHeight;
         }
         
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const rad = (-rotation * Math.PI) / 180;
        
        const localX = (px - centerX) * Math.cos(rad) - (py - centerY) * Math.sin(rad);
        const localY = (px - centerX) * Math.sin(rad) + (py - centerY) * Math.cos(rad);
        
        return localX >= -obj.width/2 && localX <= obj.width/2 &&
               localY >= -obj.height/2 && localY <= obj.height/2;
    }
             
    countLines(text, maxWidth) {
        // Quick line count without creating canvas
        const lines = text.split('\n');
        let totalLines = 0;
        
        for (const line of lines) {
            if (line.trim() === '') {
                totalLines += 1;
            } else {
                // Estimate wrapped lines (rough calculation)
                const estimatedCharsPerLine = Math.max(Math.floor(maxWidth / 8), 1);
                const wrappedLines = Math.max(1, Math.ceil(line.length / estimatedCharsPerLine));
                totalLines += wrappedLines;
            }
        }
        
        return totalLines;
    }

}