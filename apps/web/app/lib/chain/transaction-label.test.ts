import {expect,it} from 'vitest';
import {transactionLabel} from './transaction-label';
it('keeps account identity out of the action label without losing the action',()=>{
 expect(transactionLabel({signer:'5Alice',call:'subtensorModule.setWeights',summary:'5Alice set weights on subnet 367 for 4 UIDs'})).toBe('Set weights on subnet 367 for 4 UIDs');
 expect(transactionLabel({signer:'5Alice',call:'balances.transfer',summary:'Failed: 5Alice tried to transfer 1 TAO'})).toBe('Failed: transfer 1 TAO');
});
it('formats raw call names when no decoded summary is available',()=>{
 expect(transactionLabel({signer:'5Alice',call:'subtensorModule.commitTimelockedMechanismWeights',summary:'5Alice subtensorModule.commitTimelockedMechanismWeights'})).toBe('Commit timelocked mechanism weights');
 expect(transactionLabel({signer:null,call:'subtensorModule.commitTimelockedMechanismWeights'})).toBe('Commit timelocked mechanism weights');
});
