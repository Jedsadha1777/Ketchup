export const MAP_OBJECT_TYPES = {
    WALL: 'wall',
    CORRIDOR: 'corridor', 
    ROOM: 'room',
    WAYPOINT: 'waypoint',
    warppoint: 'warppoint'
};

export const MAP_OBJECT_STYLES = {
    [MAP_OBJECT_TYPES.WALL]: {
        color: '#2c3e50',      // Dark gray
        strokeColor: '#34495e',
        strokeWidth: 2,
        opacity: 1.0
    },
    [MAP_OBJECT_TYPES.CORRIDOR]: {
        color: '#f39c12',      // Orange
        strokeColor: '#d68910',
        strokeWidth: 1,
        opacity: 0.7
    },
    [MAP_OBJECT_TYPES.ROOM]: {
        color: '#3498db',      // Blue
        strokeColor: '#2980b9',
        strokeWidth: 1,
        opacity: 0.5
    },
    [MAP_OBJECT_TYPES.WAYPOINT]: {
        color: '#e74c3c',      // Red
        strokeColor: '#c0392b',
        strokeWidth: 2,
        opacity: 1.0,
        radius: 8              // For circle waypoints
    },
    [MAP_OBJECT_TYPES.warppoint]: {
        color: '#9b59b6',      // Purple
        strokeColor: '#8e44ad',
        strokeWidth: 2,
        opacity: 1.0,
        radius: 10             // Slightly larger than waypoint
    }
};