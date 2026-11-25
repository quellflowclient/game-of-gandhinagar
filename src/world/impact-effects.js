import * as THREE from 'three';
export function createImpactEffects(scene,camera){
  const count=36,pos=new Float32Array(count*3),vel=new Float32Array(count*3),geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0xd9b77c,size:.12,transparent:true,opacity:0,depthWrite:false});
  const points=new THREE.Points(geo,mat);points.frustumCulled=false;points.visible=false;scene.add(points);let life=0,shake=0;
  return{
    burst(p){life=1;shake=p.player?.5:0;points.visible=true;points.position.set(p.x,p.y,p.z);
      for(let i=0;i<count;i++){const j=i*3;pos[j]=pos[j+1]=pos[j+2]=0;vel[j]=(Math.random()-.5)*3;vel[j+1]=Math.random()*2;vel[j+2]=(Math.random()-.5)*3;}
      if(p.player){document.body.classList.remove('impact-flash');void document.body.offsetWidth;document.body.classList.add('impact-flash');}
    },
    update(dt){if(life>0){life-=dt;for(let i=0;i<count;i++){const j=i*3;pos[j]+=vel[j]*dt;pos[j+1]=Math.max(-.4,pos[j+1]+vel[j+1]*dt);pos[j+2]+=vel[j+2]*dt;vel[j+1]-=3*dt;}geo.attributes.position.needsUpdate=true;mat.opacity=Math.max(0,life);if(life<=0)points.visible=false;}
      if(shake>0){shake-=dt;camera.position.x+=Math.sin(shake*79)*shake*.18;camera.position.y+=Math.cos(shake*91)*shake*.1;}
    }
  };
}
