import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bittensor as bt
from bitcode_runner.funding import assert_development_chain
async def main():
 await assert_development_chain()
 async with bt.Subtensor('ws://127.0.0.1:9944', fallback_endpoints=[], policy=bt.Policy(max_spend_tao=0)) as c:
  mg=await c.subnets.metagraph(1)
  print(mg)
  for n in mg.neurons: print(n)
  for name in ['Burn','MinAllowedWeights','MaxWeightsLimit','WeightsSetRateLimit','CommitRevealWeightsEnabled','NetworkMinStake','SubnetOwner','SubnetOwnerHotkey','RegistrationAllowed']:
   try: print(name, await c.query(getattr(bt.storage.SubtensorModule,name), [1]))
   except Exception as e: print(name,type(e).__name__, str(e)[:100])
asyncio.run(main())
