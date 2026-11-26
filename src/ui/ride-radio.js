import {gameMusic} from '../systems/game-music.js';
// Kept as the game integration point. Old YouTube and device song players are
// removed: every ride uses the same bundled soundtrack without restarting it.
export function createRideRadio(app){
 gameMusic.preferences(app.sound.state);
 const sync=vehicle=>{gameMusic.preferences(app.sound.state);gameMusic.mode(vehicle,!!app.voice?.active||!!app.voiceRoom?.room);};
 return{select(vehicle){sync(vehicle);gameMusic.unlock();},update:sync};
}
