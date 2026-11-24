// HD by default: never trade away canvas resolution to hide slow frames.
export function hdPixelRatio(width,height,dpr=1){
 return Math.min(3,Math.max(1,dpr,1080/Math.min(width,height)),Math.sqrt(8_000_000/(width*height)));
}
