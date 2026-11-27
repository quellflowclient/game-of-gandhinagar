import {h} from './dom.js';
import {createArrivalScene} from './arrival-scene.js';

const details={
 gift:['GIFT City','Glass towers. A different kind of city walk.','ગિફ્ટ સિટી'],
 swarnim:['Swarnim Park','Room to slow down, right in the heart of the city.','સ્વર્ણિમ પાર્ક'],
 dandi:['Mahatma Mandir','The bridge, the water, the familiar silhouette.','મહાત્મા મંદિર'],
 swagat:['Swagat Holiday Mall','A Sargasan stop for your next conversation.','સ્વાગત મોલ'],
 ldrp:['LDRP-ITR','Campus paths and the people along the way.','એલડીઆરપી']
};

export function createArrival({gameName,signedIn,places,onExplore,onSignIn,onPlace,demo,renderer,lowEnd,tourMode}){
 const music=document.getElementById('music-mute');
 const pause=h('button',{type:'button',class:'arrival-pause','aria-label':'Pause or play the cinematic scene'},'Pause scene');
 const viewport=h('div',{class:'arrival-viewport','aria-hidden':'true'},h('img',{class:'arrival-fallback',src:'/art/mahatma-mandir-1920.webp',alt:'',width:1920,height:1440,fetchpriority:'high',decoding:'async'}));
 const root=h('div',{id:'landing',class:'arrival-screen'},
  h('header',{class:'arrival-header'},
   h('div',{class:'arrival-identity'},h('span',{class:'arrival-symbol','aria-hidden':'true'},'g'),h('span',{},h('strong',{},'People of'),h('b',{},'Gandhinagar'))),
   h('div',{class:'arrival-account'},music,h('button',{type:'button',class:'arrival-signin',onclick:onSignIn},signedIn?'My account':'Sign in',h('span',{'aria-hidden':'true'},'↗')))),
  h('main',{class:'arrival-main'},
   h('section',{class:'arrival-hero','aria-labelledby':'arrival-title'},
    viewport,h('div',{class:'arrival-shade','aria-hidden':'true'}),
    h('div',{class:'arrival-scene-top'},h('span',{},h('i',{'aria-hidden':'true'}),'A LITTLE CLOSER TO YOUR CITY'),pause),
    h('div',{class:'arrival-story'},
     h('p',{class:'arrival-kicker'},'GANDHINAGAR, GUJARAT'),
     h('h1',{id:'arrival-title',class:'arrival-title'},'Gandhinagar,',h('em',{},'come on in.')),
     h('p',{class:'arrival-description'},'Take a walk. Find your people. Make a little time for chai.'),
     h('div',{class:'arrival-enter-row'},h('button',{type:'button',class:'arrival-enter',onclick:onExplore},'Enter the city',h('span',{'aria-hidden':'true'},'↗')),h('span',{class:'arrival-visitor'},'Explore as a visitor',h('small',{},'No account needed')))),
    h('div',{class:'arrival-scene-bottom'},h('span',{class:'arrival-gujarati',lang:'gu'},'આપણું ગાંધીનગર.'),h('div',{class:'arrival-scene-caption'},h('span',{},'THE CITY AT EASE'),h('b',{},'Mahatma Mandir'),h('small',{},'A real view, brought into motion.')))),
   h('section',{class:'arrival-discover','aria-labelledby':'arrival-discover-title'},
    h('div',{class:'arrival-discover-intro'},h('p',{class:'arrival-section-label'},'FIND YOUR GANDHINAGAR'),h('h2',{id:'arrival-discover-title'},'A familiar place.',h('em',{},'A new possibility.')),h('p',{},'Five places to explore. Walk within each area, then take the in-game metro to your next stop.')),
    h('div',{class:'arrival-destinations'},places.map((p,index)=>{const [name,description,gu]=details[p.id]||[p.name,p.blurb,p.gu];return h('button',{type:'button',class:'arrival-destination',onclick:()=>onPlace(p.id)},h('span',{class:'arrival-destination-number','aria-hidden':'true'},String(index+1).padStart(2,'0')),h('span',{class:'arrival-destination-copy'},h('b',{},name),h('small',{},description)),h('span',{class:'arrival-destination-gu',lang:'gu'},gu),h('span',{class:'arrival-destination-arrow','aria-hidden':'true'},'↗'));}))),
   demo?h('p',{class:'arrival-demo'},'Demo mode · Your data stays in this browser.'):null),
  h('footer',{class:'arrival-footer'},h('div',{class:'arrival-footer-top'},h('p',{},'Made for the city.',h('span',{},'Made for its people.')),h('nav',{'aria-label':'Legal and support'},h('a',{href:'/privacy.html'},'Privacy'),h('a',{href:'/terms.html'},'Terms'),h('a',{href:'mailto:support@gamail.com'},'Contact'))),
   h('div',{class:'arrival-credits'},h('span',{},`© ${new Date().getFullYear()} ${gameName}`),h('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener noreferrer'},'Map data © OpenStreetMap contributors')),
   h('p',{class:'arrival-photo-credit'},'Mahatma Mandir photo: ',h('a',{href:'https://commons.wikimedia.org/wiki/File:Mahatma_Mandir-Gandhinagar.jpg',target:'_blank',rel:'noopener noreferrer'},'92saeedshaikh / Wikimedia Commons'),' · ',h('a',{href:'https://creativecommons.org/licenses/by-sa/4.0/',target:'_blank',rel:'noopener noreferrer'},'CC BY-SA 4.0'),' · Resized, cropped, animated.')));
 document.body.append(root);
 const motion=tourMode?null:createArrivalScene({host:viewport,button:pause,root,renderer,lowEnd});
 return{root,music,render:dt=>motion?.render(dt),dispose:()=>motion?.dispose()};
}
