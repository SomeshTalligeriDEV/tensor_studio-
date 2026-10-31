import type { ChainTransaction } from './explorer';
export function transactionLabel(tx: Pick<ChainTransaction,'summary'|'signer'|'call'>) {
 let label=tx.summary;
 if(label && tx.signer){
  label=label.replace(`Failed: ${tx.signer} tried to `,'Failed: ').replace(`Submitted: ${tx.signer} — `,'Submitted: ');
  if(label.startsWith(`${tx.signer} `))label=label.slice(tx.signer.length+1);
 }
 if(label===tx.call)label=undefined;
 label ||= tx.call.split('.').pop()!.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase();
 return label.charAt(0).toUpperCase()+label.slice(1);
}
