#!/usr/bin/env python3
"""Convert the historical Camelot phases 1 and 2 into one deterministic project."""
import argparse, copy, hashlib, json, math, re, tempfile
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import jsonschema
import convert_camelot_phase1 as p1

ROOT=p1.ROOT; DEFAULT_LEGACY_ROOT=p1.DEFAULT_LEGACY_ROOT; FIXED_DATE=p1.FIXED_DATE
PHASE2_PATH='levels/phase-2/level.json'

def phase_values(root, number):
    out={}
    for line in (root/f'data/levels/phase{number}.txt').read_text().splitlines():
        parts=line.split(None,1)
        if len(parts)==2: out[parts[0]]=parts[1].strip()
    return out

def world_dynamic(path):
    text=path.read_text(); header,body=re.split(r'\n\s*map\s*\n',text,maxsplit=1)
    values={}; scrolls=[]; plane=None
    for raw in header.splitlines():
        parts=raw.split()
        if not parts: continue
        if parts[0]=='num_scroll_planes_back': plane='back'
        elif parts[0]=='num_scroll_planes_front': plane='front'
        elif parts[0].startswith('scroll') and len(parts)==2 and parts[0].count('_')==0: scrolls.append({'source':parts[1],'plane':plane})
        elif parts[0].startswith('scroll') and scrolls and len(parts)==2: scrolls[-1][parts[0].split('_',1)[1]]=int(parts[1])
        elif len(parts)==2: values[parts[0]]=parts[1]
    rows=[re.findall(r'(\d+)\s+(\d+)\s+(\d+)',line) for line in body.splitlines() if line.strip()]
    if not rows or len({len(row) for row in rows})!=1: raise ValueError('Historical map is not rectangular')
    triples=[tuple(map(int,cell)) for row in rows for cell in row]
    if any(c not in (0,1,2,3) or f not in (0,1) for _,c,f in triples): raise ValueError('Unsupported historical map cell')
    return values,scrolls,triples,len(rows[0]),len(rows)

def zones_dynamic(path):
    text=path.read_text(); count=int(re.search(r'numZones\s+(\d+)',text).group(1)); numbers={k:int(v) for k,v in re.findall(r'(zone\d+_(?:start|world_size)_[xy])\s+(\d+)',text)}
    return [{'id':i-1,'left_up_x':numbers[f'zone{i}_start_x'],'left_up_y':numbers[f'zone{i}_start_y'],'right_down_x':numbers[f'zone{i}_start_x']+numbers[f'zone{i}_world_size_x'],'right_down_y':numbers[f'zone{i}_start_y']+numbers[f'zone{i}_world_size_y']} for i in range(1,count+1)]

def parse_objects(path):
    lines=[x.split() for x in path.read_text().splitlines() if x.strip()]; count=int(lines[0][1]); records=[]
    for i,row in enumerate(lines[1:]):
        if len(row)!=6: raise ValueError('Invalid object record')
        records.append({'id':i,'direction':int(row[0]),'x':int(row[1]),'y':int(row[2]),'visible':bool(int(row[3])),'name':row[4],'definition':row[5]})
    if len(records)!=count: raise ValueError('Object count mismatch')
    return records

def build_phase2(root, files, phase1):
    phase=phase_values(root,2); world_path=p1.legacy_path(root,phase['world_description']); world,scrolls,triples,width,height=world_dynamic(world_path)
    level=copy.deepcopy(phase1); level['id']='phase-2'; level['map']['width']=width; level['map']['height']=height
    tile_count=453
    tileset=p1.archive_asset(files,world_path.with_name(world['file']),'assets/maps/phase-2-tileset.bmp')
    level['map']['tileset']={'image':tileset,'tileCount':tile_count,'columns':int(world['screen_tiles_x'])//32,'imageWidth':int(world['screen_tiles_x']),'imageHeight':int(world['screen_tiles_y'])}
    level['map']['layers']={'tiles':[0 if front else gid for gid,_,front in triples],'frontTiles':[gid if front else 0 for gid,_,front in triples],'collisions':[p1.collision_gid(c,tile_count) for _,c,_ in triples]}
    parallax=[]
    for i,s in enumerate(scrolls):
        image=p1.archive_masked_bmp(files,world_path.with_name(s['source']),f'assets/maps/phase-2-parallax-{i}.png'); vx=s.get('vel_x',1); vy=s.get('vel_y',1)
        parallax.append({'id':f'phase-2-layer-{i}','image':image,'plane':s['plane'],'factorX':1/vx if s['plane']=='back' else vx,'factorY':0 if s['plane']=='back' else vy,'repeatX':True,'repeatY':s['plane']=='front'})
    level['presentation']={'parallaxLayers':parallax,'messages':[{'id':'television-message','text':'A television was collected.','durationTicks':50}],'effects':[]}
    music=p1.archive_asset(files,p1.legacy_path(root,phase['song']),'assets/music/phase-2.wav'); level['audio']['music']=[music]; level['audio']['initialMusic']=0; level['audio']['playback']['initialLoop']=True
    level['runtimeProfile']['characterForms']['initialForm']='alternate'; level['runtimeProfile']['capabilities']={'shoot':False,'bomb':False,'hit':False}
    checkpoints=p1.parse_checkpoints(p1.legacy_path(root,phase['checkpoint_description']),'left'); level['entities']={k:[] for k in ['platforms','items','backgroundObjects','blocks','hazards','lasers','triggers','enemies']}; level['entities']['checkpoints']=checkpoints; level['entities']['cameraViews']=zones_dynamic(p1.legacy_path(root,phase['scrolls']))
    definitions={'characters/player':level['definitions']['characters/player']}; enemies=[]; enemy_defs={}
    records=p1.parse_enemy_records(p1.legacy_path(root,phase['enemies_description']))
    for rec in records:
        name=Path(rec['definition']).stem; key=f'enemies/{name}'
        if key not in enemy_defs:
            bitmap=p1.archive_asset(files,root/'data/characters'/f'{name}.bmp',f'assets/enemies/{name}.bmp'); enemy_defs[key],frame=p1.enemy_definition(root/'data/characters'/rec['definition'],bitmap,1); enemy_defs[key]['frameSize']=frame
        frame=enemy_defs[key]['frameSize']; direction='left' if rec['direction']==1 else 'right'; speed=rec['speed']*4
        behavior=({'type':'xyPatrol','distanceX':abs(rec['distanceX']),'distanceY':abs(rec['distanceY']),'stepsPerTick':speed,'initialDirectionX':direction,'initialDirectionY':'up' if rec['state']==2 else 'down','respawnDelayTicks':251} if rec['type']==6 else {'type':'idle'} if rec['distanceX']==0 else {'type':'flyPatrol','axis':'horizontal','distance':abs(rec['distanceX']),'phaseTicks':max(1,math.ceil(abs(rec['distanceX'])/speed)),'initialDirection':direction})
        behavior['deathMotion']='stationary'; enemies.append({'id':rec['id'],'x':rec['x'],'y':rec['y'],'bb_x':0,'bb_y':0,'bb_width':frame['width']*4,'bb_height':frame['height']*4,'direction':direction,'speed_x':speed,'speed_y':speed if rec['type']==6 else 0,'definition':key,'visualScale':4,'combatProfile':f'phase2-enemy-{rec["id"]}','behavior':behavior})
    for d in enemy_defs.values(): d.pop('frameSize',None)
    definitions.update(enemy_defs); level['entities']['enemies']=enemies
    objects=parse_objects(p1.legacy_path(root,phase['objects'])); objdef=None
    bitmap=p1.archive_asset(files,root/'data/objects/television.bmp','assets/objects/television.bmp'); objdef=p1.object_definition(root/'data/objects/television.txt',bitmap); definitions['objects/television']=objdef; sprite=objdef['states'][0]['animation']['sprites'][0]
    for obj in objects:
        attrs={'ini_x':obj['x'],'ini_y':obj['y'],'width':sprite['width']*4,'height':sprite['height']*4,'definition':'objects/television','visualScale':4}
        if obj['visible']: level['entities']['items'].append({'id':obj['id'],'attributes':{**attrs,'physics':'fixed'},'onCollect':[{'type':'setFlag','flag':'carrying-object','value':True},{'type':'showMessage','message':'television-message'}]})
        else: level['entities']['backgroundObjects'].append({'id':obj['id'],'attributes':{**attrs,'skip_num_anims':0,'visible':0}})
    zone={'x':2390,'y':1100,'width':292,'height':400,'recursive':0,'onehot':1,'action':'enters','face':'any'}
    level['entities']['triggers']=[
      {'id':1,'attributes':zone,'gameplay':{'conditions':[{'type':'flag','flag':'carrying-object','comparison':'equal','value':True}],'sequence':'offer-television'}},
      {'id':2,'attributes':{**zone,'onehot':0,'action':'stays'},'gameplay':{'conditions':[{'type':'flag','flag':'carrying-object','comparison':'equal','value':False},{'type':'flag','flag':'offered-object','comparison':'equal','value':False}],'actions':[{'type':'emitEvent','event':'killed'}]}},
    ]
    level['definitions']=definitions
    profiles=[p for p in level['combat']['profiles'] if p['id'].startswith('player-')]
    profiles += [{'id':f'phase2-enemy-{e["id"]}','faction':'enemies','maxHealth':1,'hurtboxes':[{'id':'body','x':0,'y':0,'width':e['bb_width'],'height':e['bb_height']}],'attacks':[{'id':'contact','states':['CHAR_STATE_RUNNING','CHAR_STATE_STOP'],'x':0,'y':0,'width':e['bb_width'],'height':e['bb_height'],'damageType':'contact','damage':1,'hitOnce':False}]} for e in enemies]
    level['combat']['profiles']=profiles
    level['gameplay']={'flags':[{'id':'carrying-object','type':'boolean','initial':False},{'id':'offered-object','type':'boolean','initial':False}], 'events':[], 'sequences':[{'id':'offer-television','steps':[{'type':'action','action':{'type':'setPlayerMode','visible':True,'controllable':False}},{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':1,'visible':True,'restartAnimation':True}},{'type':'wait','ticks':50},{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':1,'visible':False}},{'type':'action','action':{'type':'setFlag','flag':'carrying-object','value':False}},{'type':'action','action':{'type':'setFlag','flag':'offered-object','value':True}},{'type':'action','action':{'type':'setPlayerMode','visible':True,'controllable':True}}]}]}
    level['objective']={'type':'reachZone','x':2390,'y':1100,'width':292,'height':400,'onComplete':'freeze','conditions':[{'type':'flag','flag':'offered-object','comparison':'equal','value':True}]}
    return level

def convert(legacy_root, output):
    legacy_root=legacy_root.resolve()
    with tempfile.TemporaryDirectory() as td:
        phase1_archive=Path(td)/'phase1.rick2-project'; p1.convert(legacy_root,phase1_archive)
        with ZipFile(phase1_archive) as z: files={n:z.read(n) for n in z.namelist()}; phase1=json.loads(files[p1.LEVEL_PATH]); report=json.loads(files['loss-report.json'])
    phase2=build_phase2(legacy_root,files,phase1)
    manifest={'formatVersion':1,'kind':'rick2.project','id':'camelot','name':'Camelot Warriors','initialLevel':p1.LEVEL_PATH,'levels':[p1.LEVEL_PATH,PHASE2_PATH],'campaign':{'order':[p1.LEVEL_PATH,PHASE2_PATH],'unlockRules':[{'level':p1.LEVEL_PATH,'requiresCompleted':[]},{'level':PHASE2_PATH,'requiresCompleted':[p1.LEVEL_PATH]}]}}
    files['project.json']=p1.json_bytes(manifest); files['game.json']=p1.json_bytes({'formatVersion':1,'kind':'rick2.game','initialLevel':p1.LEVEL_PATH}); files[PHASE2_PATH]=p1.json_bytes(phase2)
    phase2_sources=[
      'data/levels/phase2.txt','data/maps/world2_transparencia.txt','data/maps/world2_transparencia.bmp',
      'data/maps/fondo_agua.bmp','data/maps/fondo_agua2.bmp','data/characters/enemies_phase2.txt',
      'data/checkpoints/checkpoint_fase2.txt','data/scripts/phase2.txt','data/objects/objects_phase2.txt',
      'data/objects/television.txt','data/objects/television.bmp','data/machinimia/phase2.txt',
      'data/levels/scroll_zones_phase2.txt','data/music/roki.wav',
    ]
    phase2_sources += [f'data/characters/{name}.{ext}' for name in ['bombolles2','pez_azul','caballito_mar','medusa','erizo_mar','pez_rosa','pez_amarillo','pez_verde'] for ext in ['txt','bmp']]
    known={entry['path'] for entry in report['inputs']}
    report['inputs'] += [{'path':name,'sha256':hashlib.sha256((legacy_root/name).read_bytes()).hexdigest()} for name in phase2_sources if name not in known]
    report['inputs'].sort(key=lambda entry:entry['path'])
    report['losses']=sorted(report['losses'],key=lambda x:x['code']); files['loss-report.json']=p1.json_bytes(report)
    p1.validate(manifest,phase1,files); p1.validate(manifest,phase2,files)
    output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(output,'w') as z:
        for name,data in sorted(files.items()): info=ZipInfo(name,FIXED_DATE); info.compress_type=ZIP_DEFLATED; info.external_attr=0o100644<<16; z.writestr(info,data)
    return report

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--legacy-root',type=Path,default=DEFAULT_LEGACY_ROOT); ap.add_argument('--output',type=Path,default=ROOT/'build/camelot.rick2-project'); args=ap.parse_args(); report=convert(args.legacy_root,args.output); print(f'Created {args.output} with phases 1-2 and {len(report["losses"])} reported losses')
if __name__=='__main__': main()
