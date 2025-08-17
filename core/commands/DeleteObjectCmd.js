import { Command } from '../Command.js';

export class DeleteObjectCmd extends Command {
    constructor(objectManager, spatialGrid, index) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.idx = index;
        
        // Store object data for restoration
        this.objectData = {
            id: this.om.getIdByIndex(index),
            type: this.om.types[index],
            mapType: this.om.mapTypes[index],
            x: this.om.x[index],
            y: this.om.y[index],
            width: this.om.width[index],
            height: this.om.height[index],
            color: this.om.colors[index],
            label: this.om.labels[index],
            extra: this.om.extra[index]
        };
    }

    do() {
        this.sg.removeObject(this.objectData.id, this.objectData.x, this.objectData.y, 
            this.objectData.width, this.objectData.height);
        this.om.removeObject(this.idx);
    }

    undo() {
         // Recreate object at same index position
         const { id, index } = this.om.createObject(
             this.objectData.type, this.objectData.x, this.objectData.y,
             this.objectData.width, this.objectData.height, 
             this.objectData.color, this.objectData.mapType
         );
         
         this.om.labels[index] = this.objectData.label;
        // Restore extra data with proper deep copy
        if (this.objectData.extra) {
            this.om.extra[index] = JSON.parse(JSON.stringify(this.objectData.extra));
        } else {
            this.om.extra[index] = null;
        }
         
         this.sg.addObject(id, this.objectData.x, this.objectData.y, 
             this.objectData.width, this.objectData.height);
     }

}