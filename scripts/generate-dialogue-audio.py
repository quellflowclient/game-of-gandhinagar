"""Generate local neural dialogue clips. pip install edge-tts; no runtime TTS calls."""
import argparse, asyncio, hashlib, json, os, sys, shutil, subprocess
from pathlib import Path

extra=Path(os.environ.get('TEMP',''))/'gog-voice-packages'
if extra.exists(): sys.path.insert(0,str(extra))
import edge_tts

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/audio/dialogues'
FFMPEG=shutil.which('ffmpeg')
if not FFMPEG:
    bundled=Path(os.environ.get('LOCALAPPDATA',''))/'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-7.1.1-full_build/bin/ffmpeg.exe'
    if bundled.exists(): FFMPEG=str(bundled)
JOBS=[]
def add(profile,text,spoken,voice='hi-IN-MadhurNeural',rate='-2%',pitch='+0Hz'):
    digest=hashlib.sha256((profile+'|'+spoken+'|'+voice+'|'+rate+'|'+pitch).encode()).hexdigest()[:14]
    JOBS.append(dict(profile=profile,text=text,spoken=spoken,voice=voice,rate=rate,pitch=pitch,file=f'{profile}-{digest}.mp3'))

guards=[
 ('Gaadi bahar parking ma muki ne aavo.','गाड़ी बाहर पार्किंग मा मूकी ने आवो।'),
 ('ID kahan hai? ID dikhao.','आई डी कहाँ है? आई डी दिखाओ।'),
 ('ID card vagar entry nai male.','आई डी कार्ड वगर एंट्री नई मले।'),
 ('Virtual visitor pass banavi aapu.','वर्चुअल विज़िटर पास बनावी आपूँ।'),
 ('ID card batavo!','आई डी कार्ड बतावो!'),
 ('Aur beta, kaise ho?','और बेटा, कैसे हो?'),
 ('Gate ke aage mat khade raho.','गेट के आगे मत खड़े रहो।')]
for text,spoken in guards:add('guard',text,spoken,rate='-5%',pitch='-8Hz')
for profile,voice in [('male','hi-IN-MadhurNeural'),('female','hi-IN-SwaraNeural')]:
    for text,spoken in [('Babu','बाबू!'),('Chintu','चिंटू!'),('Lalbhai bhai!','लालभाई भाई!'),('Natu','नटू!'),('Masi','मासी!'),('Sarpanch','सरपंच!'),('Patel','पटेल!'),('Ajit','अजीत!')]:add(profile,text,spoken,voice,rate='+0%')
for text in ['કેમ છો! ગાંધીનગરમાં તમારું સ્વાગત છે.','એલડીઆરપી','મહાત્મા મંદિર · દાંડી કુટીર','કેમ છો! ગાંધીનગરમાં નવા છો? ચાલો, ત્રણ જણને હાથ હલાવીને કેમ છો કહો.']:
    add('male',text,text,'gu-IN-NiranjanNeural',rate='-2%')
for text in ['What do you do, and what are you working on right now?','What are you looking for in Gandhinagar?','What can people ask you about?','What is the best way to work with you?','Tell me one fun Gandhinagar thing about you.']:
    add('male',text,text,'en-IN-PrabhatNeural',rate='-2%')
add('male','Bhai, dhyaan se. Theek hai, chalo.','भाई, ध्यान से। ठीक है, चलो।')

async def main(sample=False):
    OUT.mkdir(parents=True,exist_ok=True)
    jobs=JOBS[:1] if sample else JOBS
    for index,job in enumerate(jobs):
        dest=OUT/job['file']
        if not dest.exists() or dest.stat().st_size<1000:
            temp=dest.with_suffix('.part.mp3')
            try:
                await edge_tts.Communicate(job['spoken'],job['voice'],rate=job['rate'],pitch=job['pitch'],connect_timeout=15,receive_timeout=30).save(str(temp))
                if temp.stat().st_size<1000:raise RuntimeError('No usable audio returned')
                if FFMPEG:
                    normalized=dest.with_suffix('.normalized.mp3')
                    result=subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-i',str(temp),'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','48k',str(normalized)],capture_output=True)
                    if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace'))
                    normalized.replace(temp)
                temp.replace(dest)
            except Exception:
                temp.unlink(missing_ok=True)
                raise
        print(f'{index+1}/{len(jobs)} {job["profile"]}: {job["text"]}',flush=True)
    if not sample:
        manifest={key:{} for key in ['guard','male','female']}
        for job in JOBS:manifest[job['profile']][job['text']]={'url':'/audio/dialogues/'+job['file'],'spoken':job['spoken'],'voice':job['voice']}
        (ROOT/'src/data/dialogue-recordings.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        config=ROOT/'src/data/game-defaults.json';data=json.loads(config.read_text(encoding='utf-8'))
        for key in manifest:
            data['voices'][key]['profile']=key
            data['voices'][key]['recordings']={text:value['url'] for text,value in manifest[key].items()}
        config.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        print('Generated manifest and editable admin recording URLs.',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--sample',action='store_true');args=parser.parse_args()
    asyncio.run(main(args.sample))
