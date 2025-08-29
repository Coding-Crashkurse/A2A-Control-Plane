import { useEffect, useRef } from "react";
export function useSSE<T=any>(start:()=>Promise<(data:T)=>void>|void, stop?:()=>void){
  const stopRef = useRef<null|(()=>void)>(null);
  useEffect(()=>{ let mounted=true;
    (async()=>{ const on = await start(); if(!mounted) return; stopRef.current = typeof on==="function" ? ()=>on as any : null; })();
    return ()=>{ mounted=false; if(stop) stop(); };
  },[]);
}
