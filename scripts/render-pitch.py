"""Create a 180-second, provider-neutral pitch from genuine TensorStudio footage."""
from pathlib import Path
import subprocess,json,re
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/pitch';MEDIA=ROOT/'docs/media'
chapters=json.loads((ROOT/'docs/pitch/pitch.json').read_text())
def run(args):
 r=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
 if r.returncode:raise RuntimeError(r.stderr[-3000:])
def dur(p):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
subs=[];position=0
for c in chapters:
 n=c['id'];voice=OUT/'audio'/(n+'.aiff');speed=max(1,dur(voice)/28.5)
 if n in ['04','06']:
  source=MEDIA/'architecture.png' if n=='04' else OUT/'business.png'
  args=['ffmpeg','-y','-loop','1','-i',str(source)]
  vf='scale=1920:888,pad=1920:1080:0:36:color=0x102329' if n=='04' else 'scale=1920:1080'
 else:
  source=ROOT/'artifacts/demo/segments'/({'01':'01','02':'03','03':'04','05':'07'}[n]+'.mp4')
  args=['ffmpeg','-y','-ss',str(max(0,dur(source)-30)),'-i',str(source)]
  vf='crop=1706:960:107:0,pad=1920:1080:107:0:color=0x102329,tpad=stop_mode=clone:stop_duration=30'
 args+=['-loop','1','-i',str(OUT/(n+'-bar.png')),'-i',str(voice)]
 filt=f'[0:v]{vf},fps=30,setsar=1[v];[v][1:v]overlay=0:960[brand];[2:a]atempo={speed:.6f},loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=0:30,afade=t=in:d=0.08,afade=t=out:st=29.75:d=0.25[a]'
 v='[brand]'
 if n=='06':
  args+=['-loop','1','-i',str(ROOT/'artifacts/demo/overlays/end.png')];filt+=";[brand][3:v]overlay=0:0:enable='gte(t,25)'[final]";v='[final]'
 args+=['-filter_complex',filt,'-map',v,'-map','[a]','-t','30','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(OUT/'segments'/(n+'.mp4'))]
 run(args);print('Rendered pitch',n,flush=True)
 sentences=re.split(r'(?<=[.!?])\s+',c['text']);total=sum(len(s.split()) for s in sentences);elapsed=0;spoken=min(28.5,dur(voice)/speed)
 for sentence in sentences:
  length=spoken*len(sentence.split())/total;subs.append((position+elapsed+.1,position+elapsed+length,sentence));elapsed+=length
 position+=30
playlist=OUT/'segments/concat.txt';playlist.write_text(''.join("file '"+str(OUT/'segments'/(c['id']+'.mp4'))+"'\n" for c in chapters))
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
srt=ROOT/'docs/pitch/TensorStudio-pitch.srt';srt.write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{s}' for i,(a,b,s) in enumerate(subs))+'\n')
meta=OUT/'chapters.ffmeta';lines=[';FFMETADATA1']
for i,c in enumerate(chapters):lines+=['[CHAPTER]','TIMEBASE=1/1000',f'START={i*30000}',f'END={(i+1)*30000}',f'title={c["title"]}']
meta.write_text('\n'.join(lines)+'\n')
final=MEDIA/'TensorStudio-pitch-3min.mp4'
run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(playlist),'-i',str(srt),'-i',str(meta),'-map','0:v','-map','0:a','-map','1:0','-map_metadata','2','-map_chapters','2','-c:v','copy','-c:a','copy','-c:s','mov_text','-metadata:s:s:0','language=eng','-metadata','title=TensorStudio — Build useful intelligence','-t','180','-movflags','+faststart',str(final)])
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,start_time','-of','json',str(final)]));offset=float(next(s['start_time'] for s in probe['streams'] if s['codec_type']=='video'))
normalized=OUT/'normalized.mp4';run(['ffmpeg','-y','-i',str(final),'-map','0:v','-map','0:a','-map','0:s','-map_chapters','0','-c','copy','-output_ts_offset',str(-offset),'-avoid_negative_ts','disabled','-movflags','+faststart',str(normalized)]);normalized.replace(final)
run(['ffmpeg','-v','error','-i',str(final),'-map','0:v','-map','0:a','-f','null','-'])
assert dur(final)==180
print('Pitch verified',dur(final),'seconds;',final.stat().st_size,'bytes',flush=True)
