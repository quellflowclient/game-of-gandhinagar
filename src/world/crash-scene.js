import * as THREE from 'three';
import {createAvatar} from './avatar.js';

// One nearby incident at a time: brief slow motion, then a non-violent roadside scene.
export function createCrashScene({scene,camera,traffic,player,navigation,look=()=>({}),say=()=>{}}){
  let incident=null;const projection=new THREE.Vector3(),target=new THREE.Vector3();
  const safe=p=>navigation.safePoint(p.x,p.z,p.y||0,.38,4);
  function finish(){if(!incident)return;for(const a of incident.actors){if(a.player)player.position.copy(a.avatar.root.position);a.label.remove();scene.remove(a.avatar.root);a.avatar.dispose();}
    for(const [i,v]of incident.vehicles.entries())if(v.trafficId!=null)traffic.resume(v.trafficId,i*3);
    if(incident.playerMotor)player.resumeAfterAccident();incident=null;}
  function addActor(v,i){
    const appearance=v.player?look():{},avatar=createAvatar(appearance.look||(['casual','fcasual'][i%2]),appearance.skin||0xa86b47);
    const p=safe({x:v.x+Math.cos(v.yaw||0)*(v.width/2+.65),y:v.y,z:v.z-Math.sin(v.yaw||0)*(v.width/2+.65)});
    avatar.root.position.set(p.x,p.y,p.z);scene.add(avatar.root);
    const label=document.createElement('div');label.className='accident-dialogue';label.hidden=true;document.body.append(label);
    const a={avatar,label,from:new THREE.Vector3(p.x,p.y,p.z),to:null,player:!!v.player,index:i};incident.actors.push(a);return a;
  }
  return{
    get active(){return !!incident;},
    get timeScale(){if(!incident)return 1;return incident.t<2.2?.2:incident.t<3.1?.2+(incident.t-2.2)/.9*.8:1;},
    start(hit){
      if(incident||Math.hypot(player.position.x-hit.x,player.position.z-hit.z)>(hit.player?55:28))return;
      const vehicles=[hit.a,hit.b].filter(v=>v.motor),pair=vehicles.length===2;
      incident={t:0,hit,vehicles,pair,playerMotor:vehicles.some(v=>v.player),actors:[],original:camera.position.clone(),exited:false,cues:new Set()};
      for(const v of vehicles)if(v.trafficId!=null){traffic.hold(v.trafficId,pair?26:9);traffic.damage(v.trafficId,Math.min(1.5,hit.speed/9));}
      if(!pair)return;
      const yaw=vehicles[0].yaw||0,nx=Math.cos(yaw),nz=-Math.sin(yaw),fx=Math.sin(yaw),fz=Math.cos(yaw);
      for(const [i,v]of vehicles.entries()){const a=addActor(v,i),p=safe({x:hit.x+nx*4.5+fx*(i?1:-1),y:v.y,z:hit.z+nz*4.5+fz*(i?1:-1)});a.to=new THREE.Vector3(p.x,p.y,p.z);a.avatar.root.visible=false;}
      const mediator=addActor({x:hit.x+nx*8,y:hit.y-.5,z:hit.z+nz*8,yaw,width:1},2);mediator.to=incident.actors[0].to.clone().add(incident.actors[1].to).multiplyScalar(.5).add(new THREE.Vector3(nx*.7,0,nz*.7));mediator.avatar.root.visible=false;
    },
    update(realDt){if(!incident)return;const c=incident;c.t+=realDt;const t=c.t;
      if(!c.pair){if(t>4.1)finish();return;}
      if(t>2.4&&!c.exited){c.exited=true;if(c.playerMotor)player.leaveWreck(true);}
      for(const [at,text]of [[5.6,'Bhai, dhyaan se chalao!'],[8.5,'Shaanti se baat karte hain.'],[11.5,'Bas bhai, shaanti. Alag ho jao.']])if(t>at&&!c.cues.has(at)){c.cues.add(at);say(text);}
      const [one,two,mediator]=c.actors;
      for(const a of c.actors){const med=a.index===2;a.avatar.root.visible=t>(med?9:2.4)&&t<19;
        if(!a.avatar.root.visible){a.label.hidden=true;continue;}
        const moveOut=med?THREE.MathUtils.clamp((t-9)/2.5,0,1):THREE.MathUtils.clamp((t-2.4)/3,0,1),back=med?0:THREE.MathUtils.clamp((t-15)/3.5,0,1);
        a.avatar.root.position.lerpVectors(a.from,a.to,moveOut*(1-back));
        const facing=med?one.avatar.root.position:a.index===0?two.avatar.root.position:one.avatar.root.position;
        a.avatar.root.rotation.y=Math.atan2(facing.x-a.avatar.root.position.x,facing.z-a.avatar.root.position.z);
        const walking=moveOut<1||back>0;a.avatar.setActivity(walking?null:med?'calm':t<11.5?'argue':'calm');a.avatar.update(realDt,walking?1.15:0);
        if(t>12&&t<12.1)a.avatar.gesture('yes');
        let text='';if(!med&&t>5.5&&t<8.2)text=a.index===0?'Bhai, dhyaan se chalao!':'Achanak saamne aa gaye!';
        if(!med&&t>=8.2&&t<10.8)text=a.index===0?'Gaadi ka damage dekho.':'Shaanti se baat karte hain.';
        if(med&&t>11.2&&t<14.5)text='Bas bhai, shaanti. Alag ho jao.';
        if(!med&&t>13.5&&t<15)text='Theek hai bhai. Chalo.';
        a.label.textContent=text;a.label.hidden=!text;projection.copy(a.avatar.root.position).add(new THREE.Vector3(0,2.1,0)).project(camera);
        a.label.style.left=`${(projection.x*.5+.5)*innerWidth}px`;a.label.style.top=`${(-projection.y*.5+.5)*innerHeight}px`;if(projection.z>1)a.label.hidden=true;
      }
      if(t>18.5)for(const v of c.vehicles)if(v.trafficId!=null)traffic.backAway(v.trafficId,realDt*1.1);
      if(t>20)finish();
    },
    camera(){if(!incident)return;const c=incident,t=c.t,end=c.pair?20:4.1;if(t>end)return;const hit=c.hit,weight=Math.min(1,t/.35)*Math.min(1,(end-t)/1.1);
      target.set(hit.x,hit.y+.8,hit.z);if(c.pair&&t>3.5){target.copy(c.actors[0].avatar.root.position).add(c.actors[1].avatar.root.position).multiplyScalar(.5);target.y+=1;}
      const angle=Math.atan2(c.original.x-hit.x,c.original.z-hit.z)+Math.min(t,3)*.11;
      const distance=innerWidth<700?13:10;camera.position.lerp(new THREE.Vector3(hit.x+Math.sin(angle)*distance,hit.y+4,hit.z+Math.cos(angle)*distance),weight);camera.lookAt(target);
      camera.updateMatrixWorld(true);
      for(const a of c.actors){projection.copy(a.avatar.root.position).add(new THREE.Vector3(0,2.1,0)).project(camera);a.label.style.left=`${(projection.x*.5+.5)*innerWidth}px`;a.label.style.top=`${(-projection.y*.5+.5)*innerHeight}px`;if(projection.z>1)a.label.hidden=true;}
    },
    finish,
  };
}
