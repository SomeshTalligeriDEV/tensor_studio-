import { describe, it, expect, vi } from 'vitest';
import { ChainSession, TESTNET_GENESIS, type Connection } from '@tensorstudio/chain';
function fake() {
  let onHead: (n:number,h:string)=>void=()=>{};
  let onDrop: ()=>void=()=>{};
  const stopHead=vi.fn(), stopFinality=vi.fn();
  const c: Connection<string> = {api:'api', ready:async()=>({genesis:TESTNET_GENESIS,chain:'Subtensor',runtime:'subtensor',chainType:'Development'}),heads:async cb=>{onHead=cb;return stopHead;},finality:async()=>stopFinality,onDisconnect:cb=>{onDrop=cb;},close:vi.fn(async()=>{})};
  return {c,stopHead,stopFinality,head:(n:number)=>onHead(n,`h${n}`),drop:()=>onDrop()};
}
describe('shared chain lifecycle',()=>{
  it('five switches close old connections and discard their callbacks',async()=>{
    const connections: ReturnType<typeof fake>[]=[];
    const session=new ChainSession(()=>{const f=fake();connections.push(f);return f.c;});
    for(let i=0;i<5;i++){
      await session.select(i%2?'local':'test',`ws://endpoint${i}`);
      expect(session.state.subscriptions).toBe(2);
      connections[i].head(i+10);
      for(const old of connections.slice(0,i))old.head(999);
      expect(session.state.best).toBe(i+10);
    }
    for(const old of connections.slice(0,-1)){expect(old.stopHead).toHaveBeenCalledOnce();expect(old.stopFinality).toHaveBeenCalledOnce();expect(old.c.close).toHaveBeenCalledOnce();}
    await session.dispose();expect(session.state.subscriptions).toBe(0);
  });
  it('reconnects automatically after disconnect and creates only one replacement',async()=>{
    vi.useFakeTimers();
    const connections: ReturnType<typeof fake>[]=[];
    const session=new ChainSession(()=>{const f=fake();connections.push(f);return f.c;});
    try {
      await session.select('test','wss://test');connections[0].drop();connections[0].drop();
      expect(session.state.status).toBe('Disconnected');
      await vi.advanceTimersByTimeAsync(1500);
      expect(connections.length).toBe(2);expect(session.state.subscriptions).toBe(2);
    } finally {await session.dispose();vi.useRealTimers();}
  });
});
