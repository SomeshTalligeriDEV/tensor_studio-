import {beforeEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ScanLink} from './ScanLink';
const fixture=vi.hoisted(()=>({network:'finney'}));
vi.mock('~/components/studio/ChainProvider',()=>({useChain:()=>({state:{network:fixture.network}})}));
vi.mock('@remix-run/react',()=>({Link:({to,children,className}:{to:string;children:ReactNode;className?:string})=><a href={to} className={className}>{children}</a>}));
beforeEach(()=>{fixture.network='finney';});
it('keeps mainnet block, transaction, account and subnet links inside this explorer',()=>{
 for(const [kind,value,path] of [['block','123','/scan/block/123'],['extrinsic','123-2','/scan/extrinsic/123-2'],['account','5Alice','/scan/account/5Alice'],['subnet','1','/scan/subnet/1']] as const){
  const html=renderToStaticMarkup(<ScanLink kind={kind} value={value}>Details</ScanLink>);
  expect(html).toContain(`href="${path}?network=finney"`);expect(html).not.toContain('taostats.io');
 }
});
it('preserves localnet and testnet when following detail links',()=>{
 for(const network of ['test','local']){fixture.network=network;expect(renderToStaticMarkup(<ScanLink kind="block" value="42">42</ScanLink>)).toContain(`href="/scan/block/42?network=${network}"`);}
});
