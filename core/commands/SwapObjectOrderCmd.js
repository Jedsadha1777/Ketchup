import { Command } from '../Command.js';

export class SwapObjectOrderCmd extends Command {
    constructor(objectManager, spatialGrid, index1, index2) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.index1 = index1;
        this.index2 = index2;
        this.originalSelections = [...this.om.selected];

    }

    do() {
        this.swapObjects();
        this.rebuildMappings();
        return { index1: this.index1, index2: this.index2 };
    }

    undo() {
        // Swapping is its own inverse
        this.swapObjects();

        // Restore original selections
        for (let i = 0; i < this.originalSelections.length && i < this.om.selected.length; i++) {
            this.om.selected[i] = this.originalSelections[i];
        }
        this.rebuildMappings();
    }

    swapObjects() {
        // Store original selection states
        const selection1 = this.om.selected[this.index1];
        const selection2 = this.om.selected[this.index2];

        // Swap all properties
        this.swapArrayElements(this.om.ids, this.index1, this.index2);
        this.swapArrayElements(this.om.types, this.index1, this.index2);
        this.swapArrayElements(this.om.mapTypes, this.index1, this.index2);
        this.swapArrayElements(this.om.x, this.index1, this.index2);
        this.swapArrayElements(this.om.y, this.index1, this.index2);
        this.swapArrayElements(this.om.width, this.index1, this.index2);
        this.swapArrayElements(this.om.height, this.index1, this.index2);
        this.swapArrayElements(this.om.colors, this.index1, this.index2);
        
        // Don't swap selection - handle it manually
        this.om.selected[this.index1] = false;
        this.om.selected[this.index2] = false;
        this.swapArrayElements(this.om.labels, this.index1, this.index2);
        this.swapArrayElements(this.om.extra, this.index1, this.index2);

        // Store selection info for external handling
        this.selection1 = selection1;
        this.selection2 = selection2;
    }

    swapArrayElements(arr, i1, i2) {
        [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
    }

    rebuildMappings() {
        // Rebuild ID to index mapping
        this.om.idToIndex.clear();
        for (let i = 0; i < this.om.ids.length; i++) {
            this.om.idToIndex.set(this.om.ids[i], i);
        }

        // Rebuild spatial grid
        this.sg.clear();
        for (let i = 0; i < this.om.getObjectCount(); i++) {
            const bounds = this.om.getBounds(i);
            const id = this.om.getIdByIndex(i);
            this.sg.addObject(id, bounds.x, bounds.y, bounds.width, bounds.height);
        }
    }

    merge(next) {
        // Don't merge order commands to keep granular undo
        return false;
    }
}