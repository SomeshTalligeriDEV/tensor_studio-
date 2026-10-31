import { Outlet, useLocation, useNavigate } from '@remix-run/react';
import { useState } from 'react';
import { useChain } from '~/components/studio/ChainProvider';
export default function DashboardIndex(){
 const location=useLocation();const navigate=useNavigate();const [netuid,setNetuid]=useState('');const {state}=useChain();
 if(location.pathname!=='/dashboard')return <Outlet/>;
 return <main className="studio-home"><h1>Subnet dashboard</h1><p>Enter a subnet ID to follow its actual on-chain state. Select Localnet or Testnet in the status bar.</p><form onSubmit={e=>{e.preventDefault();if(/^\d{1,5}$/.test(netuid)&&Number(netuid)<=65535)navigate(`/dashboard/${Number(netuid)}?network=${state.network}`);}}><label>Subnet ID <input aria-label="Subnet ID" required inputMode="numeric" pattern="[0-9]{1,5}" value={netuid} onChange={e=>setNetuid(e.target.value)}/></label><button type="submit">Open dashboard</button></form></main>;
}
