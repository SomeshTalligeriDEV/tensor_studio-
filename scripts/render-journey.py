"""Render a 300-second beginner/developer journey from real application captures.

Requires FFmpeg/FFprobe and the owner's local capture artifacts. No application
UI is reconstructed. TensorNode uses the user's earlier actual-app recording.
"""
from pathlib import Path
import concurrent.futures,subprocess,json,re,hashlib
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/journey';MEDIA=ROOT/'docs/media'
chapters=json.loads((ROOT/'docs/pitch/developer-journey.json').read_text())
studio=json.loads((OUT/'studio-captures.json').read_text());scenes={x['name']:x for x in studio['results']}
quest=json.loads((OUT/'quest-capture.json').read_text());builder=json.loads((OUT/'builder-capture.json').read_text())
old_home=json.loads((ROOT/'artifacts/demo/capture-manifest.json').read_text())[0]['raw']
shots=[]
def add(chapter,source,start,seconds,crop=None,still=False,label=''):
 index=sum(x['chapter']==chapter for x in shots)
 item={'chapter':chapter,'source':str(source),'start':max(0,start),'seconds':seconds,'crop':crop,'still':still,'label':label,'output':str(OUT/'segments'/f'{chapter}-{index:02}.mp4')};shots.append(item)
# First 50 seconds: problem, Bittensor roles and Studio's practical value.
add('00',OUT/'intro-idea.png',0,7,still=True,label='A concrete customer-support example')
add('00',OUT/'intro-problem.png',0,7,still=True,label='Fragmented tools and context')
add('00',OUT/'intro-roles.png',0,10,still=True,label='Conceptual Bittensor roles')
add('00',old_home,3,8,label='Actual Studio landing')
add('00',builder['raw'],builder['start']+1,8,label='Actual support-inbox interaction')
add('00',OUT/'ecosystem-card.png',0,10,still=True,label='The complete user journey')
# Quest is a newly recorded, normal-speed 40-second real game/lesson/test sequence.
add('01',quest['raw'],quest['start'],40,label='Quest movement, lesson, passed quiz, 4 local tests and progress')
# Concrete plan followed by the interface, without repeating unrelated projects.
add('02',scenes['idea']['raw'],scenes['idea']['cuts'][0]['start'],9,crop='1320:650:250:80',label='Read a suggested plan')
for offset,seconds,crop in [(-10,6,'1340:790:250:70'),(-4,4,None),(0,8,'1340:790:250:70'),(8,8,None)]:
 add('02',builder['raw'],builder['start']+offset,seconds,crop=crop,label='Actual generated code and human-review prototype')
# Explicit data, blocks, assembly and scoring report.
for i,cut in enumerate(scenes['setup']['cuts']):add('03',scenes['setup']['raw'],cut['start'],cut['seconds'],crop='1320:790:260:80' if i in [0,4] else None,label=cut['label'])
process=scenes['process'];p=process['cuts']
for start,seconds,label in [(p[0]['start'],12,'Read logs and stop'),(p[1]['start'],6,'Restart the assembled project')]:add('04',process['raw'],start,seconds,label=label)
inference=json.loads((OUT/'inference-capture.json').read_text())
add('04',inference['raw'],inference['start'],12,label='Signed live miner inference returns technical')
for cut in scenes['network']['cuts']:add('05',scenes['network']['raw'],cut['start'],cut['seconds'],label=cut['label'])
node=OUT/'source/TensorNode-actual-application-demo.mp4'
for start,seconds,crop,label in [(20,14,None,'Create a zero-spend draft'),(35,7,None,'Retrieve persisted draft'),(47,5,None,'Read stored events'),(60,4,None,'Follow the event stream'),(74,6,None,'Inspect billing'),(104,5,None,'Cancel and verify persistence'),(118,4,None,'Understand the operator boundary')]:add('06',node,start,seconds,crop=crop,label=label)
add('07',OUT/'ecosystem-card.png',0,10,still=True,label='Separate tools in one user journey')
add('07',OUT/'source-card.png',0,10,still=True,label='Exact source repository references')
add('08',OUT/'closing.png',0,15,still=True,label='Open Studio and follow the beginner guide')
assert sum(x['seconds'] for x in shots)==300
for c in chapters:assert sum(x['seconds'] for x in shots if x['chapter']==c['id'])==c['duration']
previous={s['output']:s for s in json.loads((OUT/'edit-decision-list.json').read_text())} if (OUT/'edit-decision-list.json').exists() else {}
(OUT/'edit-decision-list.json').write_text(json.dumps(shots,indent=2)+'\n')
def run(args):
 r=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
 if r.returncode:raise RuntimeError(r.stderr[-2500:])
def dur(p):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
def render_shot(s):
 target=Path(s['output'])
 if target.exists() and previous.get(s['output'])==s and target.stat().st_mtime>=Path(s['source']).stat().st_mtime and abs(dur(target)-s['seconds'])<.02:return
 args=['ffmpeg','-y']
 if s['still']:args+=['-loop','1','-framerate','30','-i',s['source']]
 else:args+=['-ss',str(s['start']),'-i',s['source']]
 args+=['-loop','1','-i',str(OUT/(s['chapter']+'-bar.png'))]
 vf=''
 if s['crop']:vf+='crop='+s['crop']+','
 if s['still']:vf+="scale=3840:2160,zoompan=z='1+0.00006*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30,"
 vf+='fps=30,scale=1920:960:force_original_aspect_ratio=decrease,pad=1920:960:(ow-iw)/2:(oh-ih)/2:color=0x102329,pad=1920:1080:0:0:color=0x102329,setsar=1,tpad=stop_mode=clone:stop_duration=10'
 filt=f'[0:v]{vf}[v];[v][1:v]overlay=0:960,format=yuv420p[final]'
 args+=['-filter_complex',filt,'-map','[final]','-an','-t',str(s['seconds']),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(target)]
 run(args);print('Rendered shot',target.name,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(render_shot,shots))
position=0;captions=[];chapter_files=[]
for c in chapters:
 n=c['id'];seconds=c['duration'];voice=OUT/'audio'/(n+'.aiff');speed=max(1,dur(voice)/(seconds-1));playlist=OUT/'segments'/(n+'-list.txt')
 playlist.write_text(''.join("file '"+s['output']+"'\n" for s in shots if s['chapter']==n))
 rendered=OUT/'segments'/(n+'-chapter.mp4');chapter_files.append(rendered)
 run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(playlist),'-i',str(voice),'-map','0:v','-map','1:a','-c:v','copy','-af',f'atempo={speed:.6f},loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=0:{seconds},afade=t=in:d=0.08,afade=t=out:st={seconds-.2}:d=0.2','-c:a','aac','-b:a','192k','-ar','48000','-t',str(seconds),'-movflags','+faststart',str(rendered)])
 sentences=re.split(r'(?<=[.!?])\s+',c['text']);total=sum(len(t.split()) for t in sentences);elapsed=0;spoken=min(seconds-1,dur(voice)/speed)
 for text in sentences:
  length=spoken*len(text.split())/total;captions.append((position+elapsed+.1,position+elapsed+length,text));elapsed+=length
 position+=seconds;print('Narration mixed',n,flush=True)
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
srt=MEDIA/'TensorStudio-developer-journey.srt';srt.write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{text}' for i,(a,b,text) in enumerate(captions))+'\n')
playlist=OUT/'segments/final-list.txt';playlist.write_text(''.join("file '"+str(p)+"'\n" for p in chapter_files))
meta=OUT/'chapters.ffmeta';lines=[';FFMETADATA1'];position=0
for c in chapters:lines+=['[CHAPTER]','TIMEBASE=1/1000',f'START={position*1000}',f'END={(position+c["duration"])*1000}',f'title={c["title"]}'];position+=c['duration']
meta.write_text('\n'.join(lines)+'\n');final=MEDIA/'TensorStudio-developer-journey-5min.mp4'
run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(playlist),'-i',str(srt),'-i',str(meta),'-map','0:v','-map','0:a','-map','1:0','-map_metadata','2','-map_chapters','2','-c:v','copy','-c:a','copy','-c:s','mov_text','-metadata:s:s:0','language=eng','-metadata','title=TensorStudio — Learn, build, evaluate and operate','-t','300','-movflags','+faststart',str(final)])
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,start_time','-of','json',str(final)]));offset=float(next(s['start_time'] for s in probe['streams'] if s['codec_type']=='video'))
normalized=OUT/'normalized.mp4';run(['ffmpeg','-y','-i',str(final),'-map','0:v','-map','0:a','-map','0:s','-map_chapters','0','-c','copy','-output_ts_offset',str(-offset),'-avoid_negative_ts','disabled','-movflags','+faststart',str(normalized)]);normalized.replace(final)
run(['ffmpeg','-v','error','-i',str(final),'-map','0:v','-map','0:a','-f','null','-']);assert dur(final)==300
verification={'durationSeconds':300,'fullDecode':'passed','resolution':'1920x1080','fps':30,'shots':len(shots),'narrated':True,'captions':True,'questSeconds':40,'tensorNodeSeconds':45,'introductionSeconds':50,'questQuizPassed':quest['quizPassed'],'questLocalTests':quest['localTestsPassed'],'signedMinerInference':inference['actualInference'],'tensorNodeSource':'existing real app recording; no paid GPU execution','sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size}
(OUT/'verification.json').write_text(json.dumps(verification,indent=2)+'\n');print(json.dumps(verification),flush=True)
