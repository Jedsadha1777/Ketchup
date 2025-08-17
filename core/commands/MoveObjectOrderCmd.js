import { Command } from '../Command.js';

export class MoveObjectOrderCmd extends Command {
    constructor(objectManager, spatialGrid, fromIndex, toIndex) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.executed = false;

        this.originalSelections = [...this.om.selected];

    }

    do() {
        if (this.executed) return;
        
        this.moveObjectInArrays(this.fromIndex, this.toIndex);
        this.rebuildMappings();
        this.executed = true;
        
        return { fromIndex: this.fromIndex, toIndex: this.toIndex };
    }

    undo() {
        if (!this.executed) return;
        
        // Reverse the operation
        this.moveObjectInArrays(this.toIndex, this.fromIndex);

        // Restore original selections
        for (let i = 0; i < this.originalSelections.length && i < this.om.selected.length; i++) {
            this.om.selected[i] = this.originalSelections[i];
        }

        this.rebuildMappings();
        this.executed = false;
    }

    moveObjectInArrays(fromIdx, toIdx) {
        if (fromIdx === toIdx) return;

        // Extract object data
        const objectData = {
            id: this.om.ids[fromIdx],
            type: this.om.types[fromIdx],
            mapType: this.om.mapTypes[fromIdx],
            x: this.om.x[fromIdx],
            y: this.om.y[fromIdx],
            width: this.om.width[fromIdx],
            height: this.om.height[fromIdx],
            color: this.om.colors[fromIdx],
            selected: false,
            label: this.om.labels[fromIdx],
            extra: this.om.extra[fromIdx]
        };

        // Remove from current position
        this.om.ids.splice(fromIdx, 1);
        this.om.types.splice(fromIdx, 1);
        this.om.mapTypes.splice(fromIdx, 1);
        this.om.x.splice(fromIdx, 1);
        this.om.y.splice(fromIdx, 1);
        this.om.width.splice(fromIdx, 1);
        this.om.height.splice(fromIdx, 1);
        this.om.colors.splice(fromIdx, 1);
        this.om.selected.splice(fromIdx, 1);
        this.om.labels.splice(fromIdx, 1);
        this.om.extra.splice(fromIdx, 1);

        // For move to front/back, don't adjust index
        const adjustedToIdx = toIdx;

        // Insert at new position
        this.om.ids.splice(adjustedToIdx, 0, objectData.id);
        this.om.types.splice(adjustedToIdx, 0, objectData.type);
        this.om.mapTypes.splice(adjustedToIdx, 0, objectData.mapType);
        this.om.x.splice(adjustedToIdx, 0, objectData.x);
        this.om.y.splice(adjustedToIdx, 0, objectData.y);
        this.om.width.splice(adjustedToIdx, 0, objectData.width);
        this.om.height.splice(adjustedToIdx, 0, objectData.height);
        this.om.colors.splice(adjustedToIdx, 0, objectData.color);
        this.om.selected.splice(adjustedToIdx, 0, objectData.selected);
        this.om.labels.splice(adjustedToIdx, 0, objectData.label);
        this.om.extra.splice(adjustedToIdx, 0, objectData.extra);


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