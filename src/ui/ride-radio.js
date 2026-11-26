import {gameMusic} from '../systems/game-music.js';
// Kept as the game integration point. Old YouTube and device song players are
// removed: every ride uses the same bundled soundtrack without restarting it.
export function createRideRadio(app){
 gameMusic.preferences(app.sound.state);
 const campus=app.world.campuses?.[0];
 const sync=vehicle=>{
  const p=app.player.position,inside=!!campus?.zone.contains(p.x,p.z);
  gameMusic.preferences(app.sound.state);
  gameMusic.mode(vehicle,!!app.voice?.active||!!app.voiceRoom?.room,inside);
 };
 return{select(vehicle){sync(vehicle);gameMusic.unlock();},update:sync};
}
