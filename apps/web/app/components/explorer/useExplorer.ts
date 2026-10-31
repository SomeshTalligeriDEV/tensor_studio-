import { useChain } from '~/components/studio/ChainProvider';
export async function bounded<T>(promise:Promise<T>,ms=20000):Promise<T>{let timer:ReturnType<typeof setTimeout>;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('RPC request timed out. Reconnect or choose another network.')),ms);})]);}finally{clearTimeout(timer!);}}
/** Compatibility view: the root provider owns the only chain connection. */
export function useExplorer(){const {state}=useChain();return {...state,index:{current:state.index}};}
