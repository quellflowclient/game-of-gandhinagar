import {browserProblem} from './browser-support.js';

function showFailure(message){
 window.gogMusic?.setMaster(false);
 const musicDialog=document.getElementById('music-choice');if(musicDialog?.open)musicDialog.close();
 const loading=document.getElementById('loading');
 if(!loading)return;
 loading.classList.remove('done');loading.setAttribute('role','alert');
 const box=document.createElement('div');box.className='ld';
 const title=document.createElement('h1');title.textContent='The city could not open';
 const detail=document.createElement('p');detail.textContent=message;
 const retry=document.createElement('button');retry.type='button';retry.textContent='Retry loading';retry.className='startup-retry';retry.onclick=()=>location.reload();
 box.append(title,detail,retry);loading.replaceChildren(box);retry.focus();
}

const problem=browserProblem(window);
if(problem)showFailure(problem);
else{
 // Start only after the compatibility check; do not waste model downloads on
 // a browser that cannot create this game. These requests overlap the JS bundle.
 for(const gender of ['male','female']){
  const link=document.createElement('link');link.rel='preload';link.as='fetch';link.crossOrigin='anonymous';
  link.href='/models/humans/'+gender+'.glb'+('DecompressionStream' in window?'.gz':'');document.head.append(link);
 }
 import('./main.js').catch(error=>{
  console.error('Game startup:',error);
  showFailure('Check your connection and retry. If 3D graphics are unavailable, update your browser or open the game in another browser.');
 });
}
