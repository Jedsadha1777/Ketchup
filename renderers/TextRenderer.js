import { ObjectRenderer } from '../types/ObjectRenderer.js';
import { TextUtils } from '../utils/TextUtils.js';


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

        // Clip text to container bounds (like Figma)
        
        
        // Set font properties
        ctx.font = `${extra.fontStyle || 'normal'} ${extra.fontWeight || 'normal'} ${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;
        ctx.fillStyle = obj.color;
        ctx.textAlign = extra.textAlign || 'left';
        ctx.textBaseline = extra.textBaseline || 'top';

        const padding = extra.padding || 4;
        const bounds = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
       
        // Only wrap if text box is manually resized 
        // let lines;
        // if (extra.isManuallyResized) {
        //     const maxWidth = Math.max(bounds.width - (padding * 2), 20);
        //     lines = TextUtils.wrapTextToLines(extra.text, maxWidth, ctx);
        // } else {
        //     lines = extra.text.split('\n');
        // }
        
        // Always wrap text to prevent side overflow
        const maxWidth = Math.max(bounds.width - (padding * 2), 20);
        const lines = TextUtils.wrapTextToLines(extra.text, maxWidth, ctx);

        let textX = obj.x + padding;
        let textY = obj.y + padding;
        
        // Adjust X position based on text alignment
        if (extra.textAlign === 'center') {
            textX = obj.x + obj.width / 2;
        } else if (extra.textAlign === 'right') {
            textX = obj.x + obj.width - padding;
        }
        
        // Draw text lines
        const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
        
        for (let i = 0; i < lines.length; i++) {
            const y = textY + (i * lineHeight);
            // Draw all lines even if they overflow 
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
            ctx.strokeStyle = '#0066cc';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
            ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            ctx.setLineDash([]);
        }
    }
    
    contains(obj, px, py) {
        // Calculate actual text bounds including overflow
        const extra = obj.extra;
        if (!extra || !extra.text) {
            // Fallback to box bounds for empty text
            return px >= obj.x && px <= obj.x + obj.width &&
                   py >= obj.y && py <= obj.y + obj.height;
        }
        
        const padding = extra.padding || 4;
        const maxWidth = Math.max(obj.width - (padding * 2), 20);
        const lines = this.countLines(extra.text, maxWidth);
        const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
        const actualHeight = lines * lineHeight + (padding * 2);
        
        // Hit test includes overflow area
        return px >= obj.x && px <= obj.x + obj.width &&
               py >= obj.y && py <= obj.y + actualHeight;
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