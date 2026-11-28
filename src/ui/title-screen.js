import {h} from './dom.js';
import {createTitleWorld} from './title-world.js';

const names={dandi:'Mahatma Mandir',gift:'GIFT City',swarnim:'Swarnim Park',swagat:'Swagat Mall',ldrp:'LDRP-ITR'};
export function createTitleScreen({places,signedIn,onPlay,onSignIn,onSignUp,onCharacter,world,renderer,scene,follow,cityObj,metro,lowEnd,tourMode}){
 let selected='dandi',preview;
 const music=document.getElementById('music-mute');
 const pause=h('button',{type:'button',class:'title-pause','aria-label':'Pause or play the city preview'},'Pause preview');
 const areaName=h('b',{class:'title-area-name'},names[selected]);
 const play=h('button',{type:'button',class:'title-play',onclick:()=>onPlay(selected)},h('span',{class:'title-play-icon','aria-hidden':'true'},'▶'),h('span',{},h('b',{},'PLAY'),h('small',{},signedIn?'Continue with your character':'Explore as a visitor')));
 const buttons=[];
 function select(id){selected=id;areaName.textContent=names[id];for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.area===id));preview?.setPlace(id);}
 const root=h('div',{id:'landing',class:'game-title-screen'},
  h('div',{class:'title-vignette','aria-hidden':'true'}),
  h('header',{class:'title-header'},h('div',{class:'title-mode'},h('span',{'aria-hidden':'true'},'◈'),'FREE ROAM'),h('div',{class:'title-tools'},music,pause)),
  h('main',{class:'title-main'},
   h('div',{class:'title-logo'},h('p',{},'PEOPLE OF'),h('h1',{},'GANDHINAGAR'),h('span',{lang:'gu'},'આપણું શહેર. આપણી રમત.')),
   h('div',{class:'title-actions'},play,
    h('div',{class:'title-auth','aria-label':'Your account'},
     !signedIn?h('button',{type:'button',class:'title-signin title-signup',onclick:()=>onSignUp(selected)},'Sign up'):null,
     h('button',{type:'button',class:'title-signin',onclick:()=>onSignIn(selected)},signedIn?'My account':'Sign in')),
    h('button',{type:'button',class:'title-character',onclick:onCharacter},'Customize character')),
   h('p',{class:'title-play-note'},'Walk · Ride · Metro · Meet')),
  h('aside',{class:'title-now','aria-label':'Starting area'},h('span',{},'STARTING AREA'),areaName,h('small',{},'Choose your first stop below')),
  h('footer',{class:'title-footer'},
   h('div',{class:'title-area-heading'},h('span',{},'CHOOSE YOUR START'),h('span',{},'5 AREAS TO EXPLORE')),
   h('div',{class:'title-areas',role:'group','aria-label':'Choose starting area'},places.map((p,index)=>{
    const b=h('button',{type:'button',class:'title-area','data-area':p.id,'aria-label':`Start at ${p.name}`,'aria-pressed':String(p.id===selected),onclick:()=>select(p.id)},h('span',{'aria-hidden':'true'},String(index+1).padStart(2,'0')),h('b',{},names[p.id]||p.name));buttons.push(b);return b;
   })),
   h('div',{class:'title-bottom'},h('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener noreferrer'},'Map © OpenStreetMap contributors'),h('nav',{'aria-label':'Legal and support'},h('a',{href:'/privacy.html',target:'_blank',rel:'noopener noreferrer'},'Privacy'),h('a',{href:'/terms.html',target:'_blank',rel:'noopener noreferrer'},'Terms'),h('a',{href:'mailto:support@gamail.com'},'Contact')))));
 document.body.append(root);
 if(!tourMode)preview=createTitleWorld({scene,renderer,follow,world,cityObj,metro,lowEnd,root,pauseButton:pause});
 return{root,music,render:dt=>preview?.render(dt),dispose:()=>preview?.dispose()};
}
