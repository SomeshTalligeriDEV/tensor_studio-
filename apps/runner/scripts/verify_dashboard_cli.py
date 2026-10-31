"""Compare the actual JS dashboard reader with btcli at one block, read-only.

The installed metagraph CLI has no --block option. Its result contains its snapshot
block; pin the JS reader there rather than comparing independent latest reads.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
RUNNER = ROOT / 'apps' / 'runner'
WEB = ROOT / 'apps' / 'web'
JS = r'''
import { ApiPromise, WsProvider } from '@polkadot/api';
import { readSubnet } from './app/lib/chain/explorer-subnet.ts';
let text=''; for await (const chunk of process.stdin) text+=chunk;
const input=JSON.parse(text);
const api=new ApiPromise({provider:new WsProvider(input.endpoint,1000),noInitWarn:true});
const timeout=setTimeout(()=>process.exit(2),60000);
try {
 await api.isReadyOrError;
 const hash=(await api.rpc.chain.getBlockHash(input.block)).toHex();
 const subnet=await readSubnet(api,input.netuid,hash);
 console.log(JSON.stringify({genesis:api.genesisHash.toHex(),hash,block:subnet.blockNumber,owner:subnet.owner,count:subnet.neuronCount,permits:subnet.neurons.filter(n=>n.validatorPermit).length,emission:subnet.emissionRao,rows:subnet.neurons.map(n=>({uid:n.uid,hotkey:n.hotkey,incentive:n.incentive,emission:n.emission,lastUpdate:n.lastUpdate,stake:n.stake,permit:n.validatorPermit}))}));
} finally {clearTimeout(timeout);await api.disconnect();}
'''


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint',default='wss://test.finney.opentensor.ai:443')
    parser.add_argument('--netuid',type=int,default=1)
    args=parser.parse_args()
    if not 0 <= args.netuid <= 65535:
        parser.error('netuid out of range')
    environment={key:os.environ[key] for key in ('PATH','HOME','LANG','TMPDIR') if key in os.environ}
    cli=[sys.executable,str(RUNNER/'.venv/bin/btcli')]
    help_result=subprocess.run([*cli,'query','metagraph','--help'],capture_output=True,text=True,check=True,env=environment,timeout=15)
    has_block='--block ' in help_result.stdout
    command=[*cli,'query','metagraph','--netuid',str(args.netuid),'--network',args.endpoint,'--fallback-endpoints','none','--archive-endpoints','none','--json']
    cli_result=subprocess.run(command,capture_output=True,text=True,check=True,env=environment,timeout=90)
    graph=json.loads(cli_result.stdout)
    block=int(graph['block'])
    js_result=subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',JS],input=json.dumps({'endpoint':args.endpoint,'netuid':args.netuid,'block':block}),capture_output=True,text=True,cwd=WEB,check=True,env=environment,timeout=75)
    actual=json.loads(js_result.stdout)
    expected_rows=[{'uid':uid,'hotkey':hotkey,'incentive':str(graph['incentives'][uid]),'emission':str(graph['emission'][uid]),'lastUpdate':int(graph['last_update'][uid]),'stake':str(graph['alpha_stake'][uid]),'permit':graph['validator_permit'][uid]} for uid,hotkey in enumerate(graph['hotkeys'])]
    checks={
        'same_block':actual['block']==block,
        'neuron_count':actual['count']==graph['num_uids'],
        'owner':actual['owner']==graph['owner_coldkey'],
        'validator_permits':actual['permits']==sum(graph['validator_permit']),
        'subnet_emission':actual['emission']==str(graph['subnet_emission']),
        'all_neuron_fields':actual['rows']==expected_rows,
    }
    print(json.dumps({'endpoint':args.endpoint,'netuid':args.netuid,'cli_supports_block_flag':has_block,'comparison_method':'CLI snapshot block pinned into JS reader','block':block,'hash':actual['hash'],'genesis':actual['genesis'],'neurons':actual['count'],'validator_permits':actual['permits'],'owner':actual['owner'],'subnet_emission_raw':actual['emission'],'first_neuron':actual['rows'][0] if actual['rows'] else None,'checks':checks},indent=2))
    if not all(checks.values()):
        raise SystemExit('Dashboard/CLI comparison failed')


if __name__=='__main__':
    main()
