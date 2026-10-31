"""Assemble genuine deployed-browser recordings with local narration. No synthetic UI."""
from pathlib import Path
import json,subprocess,re,os
ROOT=Path(__file__).resolve().parent.parent
DEMO=ROOT/'artifacts/demo'
def run(args):
 subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def duration(path):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)]))
chapters=json.loads((ROOT/'docs/demo/narration-final.json').read_text())
manifest={c['id']:c for c in json.loads((DEMO/'capture-manifest.json').read_text())}
(DEMO/'segments').mkdir(exist_ok=True)
# The AI/editor chapter uses actual Ask output followed by actual preview interaction.
for name,seconds in [('ask',10),('editor',30)]:
 raw=Path(json.loads((DEMO/(name+'-capture.json')).read_text())['raw']);out=DEMO/'segments'/(name+'.mp4')
 run(['ffmpeg','-y','-ss',str(max(0,duration(raw)-seconds)),'-i',str(raw),'-t',str(seconds),'-an','-vf','fps=30,scale=1600:900,setsar=1','-c:v','libx264','-preset','fast','-crf','20','-threads','2',str(out)])
concat=DEMO/'segments/editor-concat.txt';concat.write_text(''.join("file '"+str(DEMO/'segments'/(n+'.mp4'))+"'\n" for n in ['ask','editor']))
video3=DEMO/'segments/03-source.mp4';run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(video3)])
start=0;srt=[]
wanted=set(filter(None,os.environ.get('DEMO_CHAPTERS','').split(',')))
for chapter in chapters:
 ident=chapter['id'];seconds=chapter['duration'];raw=video3 if ident=='03' else Path(json.loads((DEMO/'process-capture.json').read_text())['raw']) if ident=='05' else Path(json.loads((DEMO/'chain-capture.json').read_text())['raw']) if ident=='07' else Path(json.loads((DEMO/'wallet-capture.json').read_text())['raw']) if ident=='08' else Path(manifest[ident]['raw']);voice=DEMO/'audio'/(ident+'.aiff');speed=max(1,duration(voice)/(seconds-1));offset=0 if ident=='03' else max(0,duration(raw)-seconds)
 filters=f'[0:v]fps=30,scale=1706:960,pad=1920:1080:107:0:color=0x102329,setsar=1[v];[v][1:v]overlay=0:960[branded];[2:a]atempo={speed:.6f},loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=0:{seconds},afade=t=in:d=0.08,afade=t=out:st={seconds-0.25}:d=0.25[a]'
 args=['ffmpeg','-y','-ss',str(offset),'-i',str(raw),'-loop','1','-i',str(DEMO/'overlays'/(ident+'.png')),'-i',str(voice)]
 if ident=='09':
  args+=['-loop','1','-i',str(DEMO/'overlays/end.png')];filters+=';[branded][3:v]overlay=0:0:enable=\'gte(t,25)\'[final]';v='[final]'
 else:v='[branded]'
 out=DEMO/'segments'/(ident+'.mp4');args+=['-filter_complex',filters,'-map',v,'-map','[a]','-t',str(seconds),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(out)]
 if not wanted or ident in wanted:
  run(args);print('Rendered chapter',ident,flush=True)
 # Searchable selectable captions, sentence-aligned within the spoken section.
 sentences=re.split(r'(?<=[.!?])\s+',chapter['text']);weights=[len(x.split()) for x in sentences];spoken=min(seconds-1,duration(voice)/speed);elapsed=0
 for line,w in zip(sentences,weights):
  length=spoken*w/sum(weights);srt.append((start+elapsed+0.15,start+elapsed+length,line));elapsed+=length
 start+=seconds
playlist=DEMO/'segments/final-concat.txt';playlist.write_text(''.join("file '"+str(DEMO/'segments'/(c['id']+'.mp4'))+"'\n" for c in chapters))
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
caption=DEMO/'TensorStudio-demo.srt';caption.write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{text}' for i,(a,b,text) in enumerate(srt))+'\n')
chapter_file=DEMO/'chapters.ffmeta'
position=0;chapter_lines=[';FFMETADATA1']
for c in chapters:
 chapter_lines += ['[CHAPTER]','TIMEBASE=1/1000',f'START={position*1000}',f'END={(position+c["duration"])*1000}',f'title={c["title"]}']
 position+=c['duration']
chapter_file.write_text('\n'.join(chapter_lines)+'\n')
final=DEMO/'TensorStudio-demo-5min.mp4';run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(playlist),'-i',str(caption),'-i',str(chapter_file),'-map_metadata','2','-map_chapters','2','-map','0:v','-map','0:a','-map','1:0','-c:v','copy','-c:a','copy','-c:s','mov_text','-metadata:s:s:0','language=eng','-metadata','title=TensorStudio — One idea. Every next step.','-metadata','comment=Real deployed browser workflows. Offline fixture timing is simulated; registration and rewards are separate.','-t','300','-movflags','+faststart',str(final)])
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,start_time','-of','json',str(final)]))
video_start=float(next(s['start_time'] for s in probe['streams'] if s['codec_type']=='video'))
if video_start:
 normalized=DEMO/'TensorStudio-demo-normalized.mp4'
 run(['ffmpeg','-y','-i',str(final),'-map','0:v','-map','0:a','-map','0:s','-map_chapters','0','-c','copy','-output_ts_offset',str(-video_start),'-avoid_negative_ts','disabled','-movflags','+faststart',str(normalized)])
 normalized.replace(final)
run(['ffmpeg','-y','-i',str(final),'-vn','-sn','-c:a','copy',str(DEMO/'TensorStudio-narration.m4a')])
print('Final duration',duration(final),'bytes',final.stat().st_size,flush=True)
