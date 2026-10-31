import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from '@remix-run/react';
import type { Network } from '@tensorstudio/chain';
import type { LiveState, createLiveSession } from '~/lib/chain/session-runtime';
import { explorerNetworks } from '~/lib/chain/networks';
import { resolveExplorerNetwork } from '~/lib/chain/network-selection';
const empty:LiveState={api:null,network:'test',endpoint:'',genesis:'',chain:'',status:'Connecting',error:'',best:null,finalized:null,generation:0,subscriptions:0,blocks:[],index:null,updated:null,progress:{done:0,total:20},revision:0,headHash:'',latencyMs:null};
const Context=createContext<{state:LiveState;localEndpoint:string;publicOnly:boolean;select:(network:Network)=>void;reconnect:()=>void}>({state:empty,localEndpoint:'',publicOnly:false,select:()=>{},reconnect:()=>{}});
export const useChain=()=>useContext(Context);
export function ChainProvider({children}:{children:ReactNode}){
  const [params,setParams]=useSearchParams();
  const requested=params.get('network');
  const [publicOnly,setPublicOnly]=useState(false);
  const network=resolveExplorerNetwork(requested,publicOnly);
  const selectedNetwork=useRef(network);selectedNetwork.current=network;
  useEffect(()=>{if(publicOnly && requested==='local'){const query=new URLSearchParams(params);query.set('network','test');query.delete('rpc');query.delete('page');setParams(query,{replace:true});}},[publicOnly,requested,params,setParams]);
  const [state,setState]=useState(empty);
  const [localEndpoint,setLocalEndpoint]=useState('');
  const [configError,setConfigError]=useState('');
  const [ready,setReady]=useState(false);
  const [bootstrap,setBootstrap]=useState(0);
  const runtime=useRef<ReturnType<typeof createLiveSession>>();
  useEffect(()=>{
    let alive=true;let owned:ReturnType<typeof createLiveSession>|undefined;
    const controller=new AbortController();
    setReady(false);
    const config=fetch('/api/chain-config',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])}).then(async r=>{if(!r.ok){const body=await r.json() as {error?:string};throw new Error(body.error || 'Local CHAIN_WS configuration is unavailable.');}return r.json() as Promise<{localEndpoint:string;publicOnly?:boolean}>;}).catch((error:Error)=>({localEndpoint:'',error:error.message}));
    void import('~/lib/chain/session-runtime').then(async module=>{
      const result=await config;
      if(!alive)return;
      setPublicOnly('publicOnly' in result && result.publicOnly===true);setLocalEndpoint(result.localEndpoint);setConfigError(result.localEndpoint?'':('error' in result ? String(result.error) : 'Local chain configuration could not be loaded. Reconnect to retry.'));
      owned=module.createLiveSession(next=>{if(alive)setState(next);});runtime.current=owned;setReady(true);
    }).catch(error=>{if(alive)setState({...empty,network:selectedNetwork.current,status:'Unavailable',error:error.message});});
    return()=>{alive=false;controller.abort();void owned?.dispose();if(runtime.current===owned)runtime.current=undefined;};
  },[bootstrap]);
  useEffect(()=>{
    if(!ready)return;
    if(network==='local'&&!localEndpoint){void runtime.current?.dispose();setState({...empty,network:'local',status:'Unavailable',error:configError});return;}
    void runtime.current?.select(network,network==='local'?localEndpoint:explorerNetworks[network].endpoint);
  },[ready,network,localEndpoint,configError]);
  useEffect(()=>{
    const offline=()=>{void runtime.current?.suspend();};
    const online=()=>{if(runtime.current)runtime.current.reconnect();else setBootstrap(x=>x+1);};
    window.addEventListener('offline',offline);window.addEventListener('online',online);
    return()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',online);};
  },[]);
  const select=(next:Network)=>{const query=new URLSearchParams(params);query.set('network',next);query.delete('rpc');query.delete('page');setParams(query);};
  const visible=state.network===network?state:{...empty,network,status:'Connecting' as const};
  const reconnect=()=>{if(!runtime.current||(network==='local'&&!localEndpoint))setBootstrap(x=>x+1);else runtime.current.reconnect();};
  return <Context.Provider value={{state:visible,localEndpoint,publicOnly,select,reconnect}}>{children}</Context.Provider>;
}
