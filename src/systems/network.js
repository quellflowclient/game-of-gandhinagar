// AbortSignal.timeout is absent in some otherwise supported mobile browsers.
export function timeoutSignal(ms){
 if(typeof AbortSignal.timeout==='function')return AbortSignal.timeout(ms);
 const controller=new AbortController();
 setTimeout(()=>controller.abort(),ms);
 return controller.signal;
}

// Also settle loaders that do not honour AbortSignal, so startup can offer Retry.
export function withDeadline(task,ms,message='Loading took too long. Please retry.'){
 const controller=new AbortController();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{controller.abort();reject(new Error(message));},ms);
  Promise.resolve().then(()=>task(controller.signal)).then(
   value=>{clearTimeout(timer);resolve(value);},
   error=>{clearTimeout(timer);reject(error);},
  );
 });
}
