// Bounded 3D render buffer. CSS text/UI remains at native device resolution.
// Default phone profile favours battery and sustained frame rate over forced HD.
export function hdPixelRatio(width,height,dpr=1,lowEnd=false){
 const cap=lowEnd?1.25:1.5,pixels=lowEnd?1_200_000:2_200_000;
 return Math.max(.5,Math.min(cap,dpr,Math.sqrt(pixels/Math.max(1,width*height))));
}

// Lower the GPU buffer after sustained expensive frames, then recover slowly.
// A single first-frame shader compile or one busy frame cannot change quality.
export function createAdaptiveQuality(lowEnd=false){
 let scale=1,samples=0,total=0,comfortable=0;
 const budget=1000/(lowEnd?24:30);
 return {
  get scale(){return scale;},
  reset(){samples=0;total=0;comfortable=0;},
  sample(workMs){
   if(!Number.isFinite(workMs)||workMs<0)return null;
   total+=Math.min(250,workMs);samples++;
   if(samples<120)return null;
   const average=total/samples;total=0;samples=0;
   const previous=scale;
   if(average>budget*.8){scale=Math.max(.65,Math.round((scale-.15)*100)/100);comfortable=0;}
   else if(average<budget*.35){if(++comfortable>=3){scale=Math.min(1,Math.round((scale+.05)*100)/100);comfortable=0;}}
   else comfortable=0;
   return scale===previous?null:scale;
  },
 };
}
