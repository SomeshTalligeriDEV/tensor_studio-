import { useEffect, useRef, useState } from 'react';
import type { ApiPromise } from '@polkadot/api';
import { useChain } from '~/components/studio/ChainProvider';
/** Coalesces slow RPC reads instead of cancelling them on each arriving block. */
export function useBlockQuery<T>(key:string,read:(api:ApiPromise,hash:string)=>Promise<T>){
  const {state}=useChain();
  const identity=`${state.generation}:${key}`;
  const [result,setResult]=useState<{identity:string;data:T|null;error:string;hash:string;busy:boolean}>({identity:'',data:null,error:'',hash:'',busy:false});
  const reader=useRef(read);reader.current=read;
  const desired=useRef(state.headHash);desired.current=state.headHash;
  const trigger=useRef<()=>void>();
  useEffect(()=>{
    let active=true,running=false,last='';
    const api=state.api;
    setResult({identity,data:null,error:'',hash:'',busy:!!api});
    const pump=async()=>{
      if(running||!active||!api||!key||!desired.current)return;
      running=true;
      try {
        while(active && desired.current && desired.current!==last){
          const hash=desired.current;last=hash;
          setResult(old=>({...old,busy:true}));
          try{const data=await reader.current(api,hash);if(active)setResult({identity,data,error:'',hash,busy:false});}
          catch(error){if(active)setResult(old=>({...old,error:error instanceof Error?error.message:'Chain read unavailable',busy:false}));}
        }
      } finally {running=false;}
    };
    trigger.current=()=>{void pump();};void pump();
    return()=>{active=false;trigger.current=undefined;};
  },[identity,state.api]);
  useEffect(()=>{trigger.current?.();},[state.headHash]);
  return result.identity===identity?result:{identity,data:null,error:'',hash:'',busy:true};
}
