import { expect, it, vi } from 'vitest';
import type { WebContainer } from '@webcontainer/api';
import { ActionRunner } from './action-runner';
import type { ActionCallbackData } from './message-parser';
const action = (type: 'shell' | 'file'): ActionCallbackData => ({artifactId:'test',messageId:'test',actionId:'0',action: type === 'shell' ? {type,content:'npm install'} : {type,filePath:'src/main.js',content:'file contents'}});
function shell(exit: Promise<number>) {
 return {spawn:async()=>({exit,kill:()=>{},output:new ReadableStream({start(controller){controller.close();}})})} as unknown as WebContainer;
}
it('marks a nonzero shell exit failed and surfaces its exit code', async () => {
 const runner = new ActionRunner(Promise.resolve(shell(Promise.resolve(17))));const data=action('shell');runner.addAction(data);await runner.runAction(data);
 await vi.waitFor(()=>expect(runner.actions.get()['0'].status).toBe('failed'));
 expect(runner.actions.get()['0']).toMatchObject({error:'Command exited with code 17.'});
});
it.each(['mkdir','writeFile'] as const)('marks a failed %s operation failed without exposing arbitrary error text', async operation => {
 const failure = Object.assign(new Error('sensitive detail must not appear'),{code:'EACCES'});
 let written = false;
 const fs = {mkdir:async()=>{if(operation==='mkdir') throw failure;},writeFile:async()=>{if(operation==='writeFile') throw failure;written=true;}};
 const runner = new ActionRunner(Promise.resolve({fs} as unknown as WebContainer));const data=action('file');runner.addAction(data);await runner.runAction(data);
 await vi.waitFor(()=>expect(runner.actions.get()['0'].status).toBe('failed'));
 expect(written).toBe(false);
 const state=runner.actions.get()['0'];expect(state).toMatchObject({error:operation==='mkdir'?'Unable to create directory (EACCES).':'Unable to write file (EACCES).'});
});
it('keeps a live server running until it exits and treats user abort as aborted',async()=>{
 let finish!:(code:number)=>void;
 const exit=new Promise<number>(resolve=>{finish=resolve;});
 const runner=new ActionRunner(Promise.resolve(shell(exit)));const data=action('shell');runner.addAction(data);await runner.runAction(data);
 await vi.waitFor(()=>expect(runner.actions.get()['0'].status).toBe('running'));
 runner.actions.get()['0'].abort();finish(143);
 // Let the exit continuation settle before asserting that it did not overwrite abort.
 await new Promise(resolve => setTimeout(resolve, 0));
 expect(runner.actions.get()['0'].status).toBe('aborted');
});
it('completes a successful command',async()=>{
 const runner=new ActionRunner(Promise.resolve(shell(Promise.resolve(0))));const data=action('shell');runner.addAction(data);await runner.runAction(data);
 await vi.waitFor(()=>expect(runner.actions.get()['0'].status).toBe('complete'));
});
