export function browserProblem(scope=globalThis){
 if(!scope.WebGL2RenderingContext)return 'This browser cannot run the 3D city. Try an updated browser with WebGL 2 enabled.';
 if(typeof scope.structuredClone!=='function'||typeof scope.Array?.prototype.at!=='function'||typeof scope.Object?.hasOwn!=='function'||typeof scope.HTMLDialogElement?.prototype.showModal!=='function')return 'Update your browser to play. This version is missing features the city needs.';
 return null;
}
