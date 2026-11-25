// Bounded 3D render buffer. CSS text/UI remains at native device resolution.
// Default phone profile favours battery and sustained frame rate over forced HD.
export function hdPixelRatio(width,height,dpr=1,lowEnd=false){
 const cap=lowEnd?1.25:1.5,pixels=lowEnd?1_200_000:2_200_000;
 return Math.max(.5,Math.min(cap,dpr,Math.sqrt(pixels/Math.max(1,width*height))));
}
