/** Browser-wide owner for one RPC connection. Adapters keep RPC/React dependencies out of the lifecycle core. */
export const TESTNET_GENESIS = '0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105';
export type Network = 'local' | 'test' | 'finney';
export type SessionState<A> = {
  api: A | null; network: Network; endpoint: string; genesis: string; chain: string;
  status: 'Connecting' | 'Connected' | 'Disconnected' | 'Unavailable'; error: string;
  best: number | null; finalized: number | null; generation: number; subscriptions: number;
};
export interface Connection<A> {
  api: A;
  ready(): Promise<{genesis: string; chain: string; runtime: string; chainType: string}>;
  heads(callback: (height: number, hash: string) => void): Promise<() => void>;
  finality(callback: (height: number) => void): Promise<() => void>;
  onDisconnect(callback: () => void): void;
  close(): Promise<void>;
}
export class ChainSession<A> {
  state: SessionState<A> = {api:null,network:'test',endpoint:'',genesis:'',chain:'',status:'Connecting',error:'',best:null,finalized:null,generation:0,subscriptions:0};
  private listeners = new Set<() => void>();
  private connection?: Connection<A>;
  private stops: (() => void)[] = [];
  private retryTimer?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private recovery?:()=>void;
  private selected?: {network: Network; endpoint: string};
  onHead?: (height: number, hash: string, generation: number) => void;
  constructor(private factory: (endpoint: string) => Connection<A>) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private publish(patch: Partial<SessionState<A>>) { this.state = {...this.state,...patch}; this.listeners.forEach(fn=>fn()); }
  private async teardown() {
    clearTimeout(this.retryTimer); this.retryTimer=undefined;
    this.stops.splice(0).forEach(stop=>stop());
    const old=this.connection;this.connection=undefined;
    if(old) await old.close().catch(()=>{});
  }
  async select(network: Network, endpoint: string, retrying = false) {
    this.selected={network,endpoint};
    if(!retrying) this.attempts=0;
    const generation=this.state.generation+1;
    this.publish({generation,network,endpoint,api:null,genesis:'',chain:'',best:null,finalized:null,subscriptions:0,status:'Connecting',error:''});
    await this.teardown();
    if(generation!==this.state.generation)return;
    const connection=this.factory(endpoint);this.connection=connection;
    const current=()=>generation===this.state.generation && this.connection===connection;
    const reconnect=()=>{
      if(!current() || this.retryTimer)return;
      this.publish({status:'Disconnected',api:null,subscriptions:0,error:'RPC disconnected. Reconnecting automatically…'});
      const delay=Math.min(30000,1000*2**this.attempts++)+Math.floor(Math.random()*250);
      this.retryTimer=setTimeout(()=>{this.retryTimer=undefined;if(current())void this.select(network,endpoint,true);},delay);
    };
    this.recovery=reconnect;
    connection.onDisconnect(reconnect);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const identity=await Promise.race([connection.ready(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('RPC connection timed out')),20000);})]);
      clearTimeout(timeout);
      if(!current())return;
      if(!identity.runtime.toLowerCase().includes('subtensor'))throw new Error('Endpoint does not expose the Subtensor runtime.');
      if(network==='local' && !['Development','Local'].includes(identity.chainType))throw new Error('Localnet must be a Development or Local chain.');
      if(network==='test' && identity.genesis!==TESTNET_GENESIS)throw new Error('Endpoint genesis does not match verified Bittensor testnet.');
      this.publish({...identity,api:connection.api,status:'Connected',error:''});
      const track=async (pending: Promise<()=>void>)=>{
        const stop=await pending;
        if(!current()){stop();return;}
        this.stops.push(stop);this.publish({subscriptions:this.stops.length});
      };
      await track(connection.heads((height,hash)=>{if(current()){this.publish({best:height});this.onHead?.(height,hash,generation);}}));
      if(!current())return;
      await track(connection.finality(height=>{if(current())this.publish({finalized:height});}));
      this.attempts=0;
    } catch(error) {
      clearTimeout(timeout);
      if(!current())return;
      this.publish({status:'Unavailable',api:null,error:error instanceof Error?error.message:'RPC unavailable'});
      reconnect();
    }
  }
  retry() { this.recovery?.(); }
  reconnect() { if(this.selected)void this.select(this.selected.network,this.selected.endpoint); }
  async suspend() { this.publish({generation:this.state.generation+1,api:null,subscriptions:0,best:null,finalized:null,status:'Disconnected',error:'Browser is offline. Reconnecting when connectivity returns.'});await this.teardown(); }
  async dispose() { this.selected=undefined;this.publish({generation:this.state.generation+1,api:null,subscriptions:0,status:'Disconnected'});await this.teardown(); }
}
