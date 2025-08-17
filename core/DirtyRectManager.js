export class DirtyRectManager {
    constructor() { 
        this.dirtyRects = [];
        this.maxRects = 10; // Limit number of rects to prevent too many draw calls
    }
    
    addDirtyRect(x, y, width, height) {
        // Add padding and round to pixel boundaries
        const padding = 2;
        const rect = {
            x: Math.floor(x - padding),
            y: Math.floor(y - padding),
            width: Math.ceil(width + padding * 2),
            height: Math.ceil(height + padding * 2)
        };
        
        // Try to merge with existing rects
        this.dirtyRects = this.mergeRect(this.dirtyRects, rect);
        
        // If too many rects, merge them more aggressively
        if (this.dirtyRects.length > this.maxRects) {
            this.coalesceDirtyRects();
        }
    }
    
    mergeRect(rects, newRect) {
        const merged = [];
        let wasMerged = false;
        
        for (const rect of rects) {
            if (!wasMerged && this.rectsOverlap(rect, newRect)) {
                // Merge overlapping rects
                merged.push(this.unionRects(rect, newRect));
                wasMerged = true;
            } else if (!wasMerged && this.rectsNearby(rect, newRect, 10)) {
                // Merge nearby rects (within 10 pixels)
                merged.push(this.unionRects(rect, newRect));
                wasMerged = true;
            } else {
                merged.push(rect);
            }
        }
        
        if (!wasMerged) {
            merged.push(newRect);
        }
        
        return merged;
    }
    
    rectsOverlap(r1, r2) {
        return !(r1.x + r1.width < r2.x || 
                 r2.x + r2.width < r1.x || 
                 r1.y + r1.height < r2.y || 
                 r2.y + r2.height < r1.y);
    }
    
    rectsNearby(r1, r2, threshold) {
        const expandedR1 = {
            x: r1.x - threshold,
            y: r1.y - threshold,
            width: r1.width + threshold * 2,
            height: r1.height + threshold * 2
        };
        return this.rectsOverlap(expandedR1, r2);
    }
    
    unionRects(r1, r2) {
        const minX = Math.min(r1.x, r2.x);
        const minY = Math.min(r1.y, r2.y);
        const maxX = Math.max(r1.x + r1.width, r2.x + r2.width);
        const maxY = Math.max(r1.y + r1.height, r2.y + r2.height);
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    coalesceDirtyRects() {
        // Aggressive merging when there are too many rects
        if (this.dirtyRects.length <= 1) return;
        
        // Find the bounding box of all rects
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const rect of this.dirtyRects) {
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
        }
        
        const boundingArea = (maxX - minX) * (maxY - minY);
        let totalArea = 0;
        
        for (const rect of this.dirtyRects) {
            totalArea += rect.width * rect.height;
        }
        
        // If the bounding box is not much larger than individual rects,
        // merge everything into one rect
        if (boundingArea < totalArea * 1.5) {
            this.dirtyRects = [{
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            }];
        } else {
            // Otherwise, try to merge overlapping rects
            this.mergeOverlappingRects();
        }
    }
    
    mergeOverlappingRects() {
        const merged = [];
        const processed = new Set();
        
        for (let i = 0; i < this.dirtyRects.length; i++) {
            if (processed.has(i)) continue;
            
            let currentRect = { ...this.dirtyRects[i] };
            processed.add(i);
            
            // Try to merge with other rects
            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < this.dirtyRects.length; j++) {
                    if (processed.has(j)) continue;
                    
                    if (this.rectsOverlap(currentRect, this.dirtyRects[j])) {
                        currentRect = this.unionRects(currentRect, this.dirtyRects[j]);
                        processed.add(j);
                        changed = true;
                    }
                }
            }
            
            merged.push(currentRect);
        }
        
        this.dirtyRects = merged;
    }
    
    clear() { 
        this.dirtyRects = []; 
    }
    
    getDirtyRects() { 
        return this.dirtyRects; 
    }
}