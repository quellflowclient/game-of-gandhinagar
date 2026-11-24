export const CAMERA_MODES=[
 {id:'follow',name:'Third person',detail:'Walk with the camera behind you.',fov:58,distance:6.5},
 {id:'wide',name:'Wide view',detail:'See more of the road, shops and surroundings.',fov:78,distance:9.5},
 {id:'front',name:'Front view',detail:'See your character from the front.',fov:58,distance:5.5},
 {id:'orbit',name:'Free orbit',detail:'Drag around 360°; pinch or scroll to zoom.',fov:65,distance:7.5},
 {id:'eyes',name:'Eye level',detail:'Look from your character’s eyes. Drag to look around.',fov:70,distance:0},
];
export const cameraMode=id=>CAMERA_MODES.find(m=>m.id===id)||CAMERA_MODES[0];
