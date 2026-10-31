import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {LocalnetConnection,NetworkTools} from './NetworkTools';
it('distinguishes localnet startup from disconnection and offers recovery',()=>{
 const connecting=renderToStaticMarkup(<LocalnetConnection status="Connecting" reconnect={()=>{}} selectTestnet={()=>{}}/>);
 expect(connecting).toContain('Connecting to localnet');expect(connecting).not.toContain('offline');
 const disconnected=renderToStaticMarkup(<LocalnetConnection status="Disconnected" reconnect={()=>{}} selectTestnet={()=>{}}/>);
 expect(disconnected).toContain('Resume localnet');expect(disconnected).toContain('Retry connection');expect(disconnected).toContain('Connect to testnet');
 expect(renderToStaticMarkup(<LocalnetConnection status="Connected" reconnect={()=>{}} selectTestnet={()=>{}}/>)).toBe('');
});
it('separates public testnet faucets from local development funding',()=>{
 const test=renderToStaticMarkup(<NetworkTools network="test"/>);
 expect(test).toContain('https://taoswap.org/testnet-faucet');expect(test).toContain('Community faucet');
 const local=renderToStaticMarkup(<NetworkTools network="local"/>);
 expect(local).toContain('Alice');expect(local).toContain('read-only');expect(local).toContain('Public testnet tokens do not work on localnet');
 expect(renderToStaticMarkup(<NetworkTools network="finney"/>)).not.toContain('testnet-faucet');
});
