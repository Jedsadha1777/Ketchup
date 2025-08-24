import { ObjectRenderer } from '../types/ObjectRenderer.js';

export class ImageRenderer extends ObjectRenderer {
    constructor(imageManager, renderCallback) {
        super();
        this.imageManager = imageManager;
        this.renderCallback = renderCallback;
    }

    canRender(obj) {
        return obj.type === 'image';
    }

    getAvailableProperties(obj) {
        return ['label', 'opacity', 'rotation'];
    }

    draw(obj, ctx, view) {
        if (!obj.extra || !obj.extra.src) {
            // Draw placeholder if no image
            this.drawPlaceholder(obj, ctx, view);
            return;
        }

        const img = this.imageManager.getImage(obj.extra.src);
        if (!img) {
            // Draw loading placeholder
            this.drawLoadingPlaceholder(obj, ctx, view);
            
            // Try to load image async
            this.imageManager.loadImage(obj.extra.src).then(() => {
                // Trigger re-render when image loads
                if (this.renderCallback) {
                    this.renderCallback();
                }
            }).catch(() => {
                // Draw error placeholder on next render
            });
            return;
        }

        // Draw image
        ctx.save();
        
        if (obj.extra.opacity !== undefined) {
            ctx.globalAlpha = obj.extra.opacity;
        }
        
        //  rotation
        const rotation = obj.extra?.rotation || 0;
        if (rotation !== 0) {
            const centerX = obj.x + obj.width / 2;
            const centerY = obj.y + obj.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-obj.width / 2, -obj.height / 2);
            this.drawImageWithFit(ctx, img, 0, 0, obj.width, obj.height, obj.extra.fit || 'contain');
        } else {
            this.drawImageWithFit(ctx, img, obj.x, obj.y, obj.width, obj.height, obj.extra.fit || 'contain');
        }

        ctx.restore();
        
        this.drawSelection(obj, ctx, view);
    }

    drawImageWithFit(ctx, img, x, y, width, height, fit) {
        const imgRatio = img.width / img.height;
        const boxRatio = width / height;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (fit === 'cover') {
            if (imgRatio > boxRatio) {
                // Image is wider - fit height, crop width
                drawHeight = height;
                drawWidth = height * imgRatio;
                offsetX = (width - drawWidth) / 2;
                offsetY = 0;
            } else {
                // Image is taller - fit width, crop height
                drawWidth = width;
                drawHeight = width / imgRatio;
                offsetX = 0;
                offsetY = (height - drawHeight) / 2;
            }
        } else { // 'contain' or default
            if (imgRatio > boxRatio) {
                // Image is wider - fit width
                drawWidth = width;
                drawHeight = width / imgRatio;
                offsetX = 0;
                offsetY = (height - drawHeight) / 2;
            } else {
                // Image is taller - fit height
                drawHeight = height;
                drawWidth = height * imgRatio;
                offsetX = (width - drawWidth) / 2;
                offsetY = 0;
            }
        }

        ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
    }

    drawPlaceholder(obj, ctx, view) {
        // Draw gray placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2 / view.zoom;
        
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        
        // Draw "No Image" text
        ctx.fillStyle = '#666';
        ctx.font = `${14 / view.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Image', obj.x + obj.width/2, obj.y + obj.height/2);
        
        this.drawSelection(obj, ctx, view);
    }

    drawLoadingPlaceholder(obj, ctx, view) {
        // Draw loading placeholder
        ctx.fillStyle = '#e8f4f8';
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2 / view.zoom;
        
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        
        // Draw "Loading..." text
        ctx.fillStyle = '#2196F3';
        ctx.font = `${14 / view.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Loading...', obj.x + obj.width/2, obj.y + obj.height/2);
        
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
