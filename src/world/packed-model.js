// Lossless gzip transfer; original GLBs remain the compatibility fallback.
export async function loadPackedGltf(loader,path,onProgress){
 if(!('DecompressionStream' in window))return loader.loadAsync(path,onProgress);
 try{
  const response=await fetch(path+'.gz');if(!response.ok||!response.body)throw new Error('Packed model unavailable');
  const total=Number(response.headers.get('Content-Length'))||0;let loaded=0,stream=response.body;
  if(onProgress)stream=stream.pipeThrough(new TransformStream({transform(chunk,controller){loaded+=chunk.byteLength;onProgress({loaded,total});controller.enqueue(chunk);}}));
  // Fetch transparently decodes a response served with Content-Encoding:gzip.
  // Static .gz files without that header need explicit decompression.
  if(!response.headers.get('Content-Encoding')?.includes('gzip'))stream=stream.pipeThrough(new DecompressionStream('gzip'));
  const data=await new Response(stream).arrayBuffer();
  return await loader.parseAsync(data,path.slice(0,path.lastIndexOf('/')+1));
 }catch{return loader.loadAsync(path,onProgress);}
}
