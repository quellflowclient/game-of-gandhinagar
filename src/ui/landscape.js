// Follow the phone's own orientation. Portrait gameplay is fully supported;
// fullscreen never requests an orientation lock.
function installLandscape(){
 try{screen.orientation?.unlock?.();}catch{}
 const refresh=()=>{
  for(const name of ['landscape-required','game-rotation-required','portrait-page-mode'])if(document.body.classList.contains(name))document.body.classList.remove(name);
  document.getElementById('landscape-gate')?.remove();
 };
 for(const name of ['resize','orientationchange','pageshow'])window.addEventListener(name,refresh);
 refresh();
 return{get required(){return false;},async request(){return false;},async toggleFullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.();}catch{}
 }};
}
export const landscape=installLandscape();
