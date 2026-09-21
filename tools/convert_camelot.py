#!/usr/bin/env python3
"""Convert the historical Camelot phases 1 and 2 into one deterministic project."""
import argparse, copy, hashlib, json, math, re, struct, tempfile, zlib
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import jsonschema
import convert_camelot_phase1 as p1

ROOT=p1.ROOT; DEFAULT_LEGACY_ROOT=p1.DEFAULT_LEGACY_ROOT; FIXED_DATE=p1.FIXED_DATE
PHASE2_PATH='levels/phase-2/level.json'
PHASE3_PATH='levels/phase-3/level.json'
PHASE4_PATH='levels/phase-4/level.json'

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
    if any(c not in (0,1,2,3) or f not in (0,1,2) for _,c,f in triples): raise ValueError('Unsupported historical map cell')
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

def parse_phase3_enemy_control_zones(path):
    tokens=path.read_text().split(); index=0
    if tokens[index:index+2] != ['num_scripts','7']: raise ValueError('Invalid phase-3 script header')
    index += 2; records=[]
    for _ in range(7):
        bounds=tuple(map(int,tokens[index:index+4])); index += 4
        if tokens[index] != 'input_vars': raise ValueError('Invalid phase-3 script input marker')
        count=int(tokens[index+1]); index += 2; inputs={tokens[index+2*i]:int(tokens[index+2*i+1]) for i in range(count)}; index += count*2
        if tokens[index] != 'output_vars': raise ValueError('Invalid phase-3 script output marker')
        count=int(tokens[index+1]); index += 2; outputs={tokens[index+2*i]:int(tokens[index+2*i+1]) for i in range(count)}; index += count*2
        records.append({'bounds':bounds,'inputs':inputs,'outputs':outputs})
    if index != len(tokens): raise ValueError('Unexpected phase-3 script data')
    selected=[record for record in records if any(key.startswith('enemy_') for key in record['outputs'])]
    expected=[
      {'bounds':(6373,514,88,213),'inputs':{},'outputs':{'enemy_reset_16':1,'enemy_reset_7':1,'enemy_activated_16':0,'enemy_activated_7':0}},
      {'bounds':(6461,512,85,214),'inputs':{},'outputs':{'enemy_activated_16':1,'enemy_activated_7':1,'keepMoving':1}},
    ]
    if selected != expected: raise ValueError('Unsupported phase-3 enemy control zones')
    return selected

def parse_enemy_records_dynamic(path):
    lines=[x.split() for x in path.read_text().splitlines() if x.strip()]
    if len(lines[0]) != 2 or lines[0][0].lower() not in ('numenemigos','num_enemies'):
        raise ValueError('Invalid historical enemy header')
    records=[]
    for row in lines[1:]:
        if len(row) != 11: raise ValueError('Invalid historical enemy record')
        values=list(map(int,row[:10]))
        records.append(dict(zip(('id','type','state','direction','verticalDirection','x','y','distanceX','distanceY','speed'),values),definition=row[10]))
    if len(records) != int(lines[0][1]): raise ValueError('Enemy count mismatch')
    return records

def archive_masked_flipped_crop(files, source, destination, x, y, width, height):
    data=source.read_bytes(); offset=struct.unpack_from('<I',data,10)[0]; image_width,image_height=struct.unpack_from('<ii',data,18); stride=(image_width*3+3)&~3
    rows=[]
    for output_y in range(height):
        row=bytearray([0])
        for output_x in range(width):
            source_x=x+width-1-output_x; source_y=abs(image_height)-1-(y+output_y) if image_height>0 else y+output_y; start=offset+source_y*stride+source_x*3; blue,green,red=data[start:start+3]; alpha=0 if (red,green,blue)==(255,0,255) else 255; row.extend((red,green,blue,alpha))
        rows.append(bytes(row))
    def chunk(kind,payload): return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
    files[destination]=png; return '../../'+destination

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
    level['presentation']={'parallaxLayers':parallax,'messages':[{'id':'television-message','text':'El espejo de la sabiduria','durationTicks':50}],'effects':[],'postProcessEffects':[{'id':'water-distortion','kind':'horizontalStripDisplacement','strips':48,'maxOffset':4,'periodMs':25}]}
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

def build_phase3(root, files, phase1):
    phase=phase_values(root,3); world_path=p1.legacy_path(root,phase['world_description']); world,scrolls,triples,width,height=world_dynamic(world_path)
    parse_phase3_enemy_control_zones(p1.legacy_path(root,phase['scripts']))
    level=copy.deepcopy(phase1); level['id']='phase-3'; tile_count=453
    tileset=p1.archive_asset(files,world_path.parent/world['file'],'assets/maps/phase-3-tileset.bmp')
    # Legacy collision 3 only set `stairs_right`; the historical transition
    # graph never consumed that signal, so these foreground fence cells were
    # decorative and traversable rather than physical right-rising slopes.
    level['map']={'width':width,'height':height,'tileWidth':32,'tileHeight':32,'tileset':{'image':tileset,'tileCount':tile_count,'columns':int(world['screen_tiles_x'])//32,'imageWidth':int(world['screen_tiles_x']),'imageHeight':int(world['screen_tiles_y'])},'layers':{'tiles':[0 if f else g for g,_,f in triples],'frontTiles':[g if f else 0 for g,_,f in triples],'collisions':[0 if c==3 else p1.collision_gid(c,tile_count) for _,c,_ in triples]}}
    parallax=[]
    for i,s in enumerate(scrolls):
        image=p1.archive_masked_bmp(files,world_path.parent/s['source'],f'assets/maps/phase-3-parallax-{i}.png'); vx=s.get('vel_x',1); vy=s.get('vel_y',1)
        parallax.append({'id':f'phase-3-layer-{i}','image':image,'plane':s['plane'],'factorX':1/vx if s['plane']=='back' else vx,'factorY':0 if s['plane']=='back' else vy,'repeatX':True,'repeatY':s['plane']=='front'})
    level['presentation']={'parallaxLayers':parallax,'messages':[{'id':'cocacola-message','text':'El elixir de la vida','durationTicks':50}],'effects':[]}
    music=p1.archive_asset(files,p1.legacy_path(root,phase['song']),'assets/music/phase-3.wav'); level['audio']['music']=[music]; level['audio']['initialMusic']=0; level['audio']['playback']['initialLoop']=True
    level['runtimeProfile']['characterForms']['initialForm']='primary'; level['runtimeProfile']['capabilities']={'shoot':True,'bomb':True,'hit':True}
    level['entities']={k:[] for k in ['platforms','items','backgroundObjects','blocks','hazards','lasers','triggers','enemies']}
    level['entities']['checkpoints']=p1.parse_checkpoints(p1.legacy_path(root,phase['checkpoint_description']),'left')
    level['entities']['cameraViews']=zones_dynamic(p1.legacy_path(root,phase['scrolls']))
    definitions={'characters/player':level['definitions']['characters/player']}; enemies=[]; enemy_defs={}
    for rec in parse_enemy_records_dynamic(p1.legacy_path(root,phase['enemies_description'])):
        name=Path(rec['definition']).stem; key=f'enemies/{name}'
        if key not in enemy_defs:
            bitmap=p1.archive_asset(files,root/'data/characters'/f'{name}.bmp',f'assets/enemies/{name}.bmp'); enemy_defs[key],frame=p1.enemy_definition(root/'data/characters'/rec['definition'],bitmap,1); enemy_defs[key]['frameSize']=frame
        frame=enemy_defs[key]['frameSize']; direction='left' if rec['direction']==1 else 'right'; speed=rec['speed']*4
        if rec['type']==6: behavior={'type':'xyPatrol','distanceX':abs(rec['distanceX']),'distanceY':abs(rec['distanceY']),'stepsPerTick':speed,'initialDirectionX':direction,'initialDirectionY':'up' if rec['state']==2 else 'down','respawnDelayTicks':251}
        elif rec['type']==7: behavior={'type':'verticalPatrol','distance':abs(rec['distanceY']),'initialDirection':'up' if rec['state']==2 else 'down','loop':False,'onLimit':'die','respawnDelayTicks':251}
        elif rec['type']==8: behavior={'type':'proximityAttack','activationDistance':1024,'delayTicks':250,'durationTicks':90,'sequence':'dragon-fire','idleAnimation':'CHAR_STATE_STOP','attackAnimation':'CHAR_STATE_RUNNING'}
        elif rec['type']==4 or rec['distanceX']==0: behavior={'type':'idle'}
        else: behavior={'type':'flyPatrol','axis':'horizontal','distance':abs(rec['distanceX']),'phaseTicks':max(1,math.ceil(abs(rec['distanceX'])/speed)),'initialDirection':direction}
        behavior['deathMotion']='stationary'
        enemies.append({'id':rec['id'],'x':rec['x'],'y':rec['y'],'bb_x':0,'bb_y':0,'bb_width':frame['width']*4,'bb_height':frame['height']*4,'direction':direction,'speed_x':speed,'speed_y':speed if rec['type'] in (6,7) else 0,'definition':key,'visualScale':4,'combatProfile':f'phase3-enemy-{rec["id"]}','behavior':behavior})
    for d in enemy_defs.values(): d.pop('frameSize',None)
    dragon_bitmap=enemy_defs['enemies/dragon']['states'][0]['animation']['bitmap']; closed={'x':1,'y':1,'width':88,'height':56}; opened={'x':90,'y':1,'width':88,'height':56}
    for state in enemy_defs['enemies/dragon']['states']:
        state['animation']={'bitmap':dragon_bitmap,'frameDurationTicks':15,'sprites':[closed if state['name']=='CHAR_STATE_STOP' else opened]}
    definitions.update(enemy_defs); level['entities']['enemies']=enemies
    bitmap=p1.archive_asset(files,root/'data/objects/cocacola.bmp','assets/objects/cocacola.bmp'); objdef=p1.object_definition(root/'data/objects/cocacola.txt',bitmap); definitions['objects/cocacola']=objdef; sprite=objdef['states'][0]['animation']['sprites'][0]
    for obj in parse_objects(p1.legacy_path(root,phase['objects'])):
        attrs={'ini_x':obj['x'],'ini_y':obj['y'],'width':sprite['width']*4,'height':sprite['height']*4,'definition':'objects/cocacola','visualScale':4}
        if obj['visible']: level['entities']['items'].append({'id':obj['id'],'attributes':{**attrs,'physics':'fixed'},'onCollect':[{'type':'setFlag','flag':'carrying-object','value':True},{'type':'setFlag','flag':'cocacola-picked','value':True},{'type':'showMessage','message':'cocacola-message'}]})
        else: level['entities']['backgroundObjects'].append({'id':obj['id'],'attributes':{**attrs,'skip_num_anims':0,'visible':0}})
    fire_bitmap=archive_masked_flipped_crop(files,root/'data/characters/dragon.bmp','assets/enemies/dragon-fire.png',179,1,24,56)
    blank={'x':0,'y':0,'width':1,'height':1}; flame={'x':0,'y':0,'width':24,'height':56}
    for segment in range(1,6):
        key=f'objects/dragon-fire-{segment}'; sprites=[blank if frame<segment else flame for frame in range(6)]; animation={'bitmap':fire_bitmap,'frameDurationTicks':15,'sprites':sprites}
        definitions[key]={'kind':'object','name':f'dragon-fire-{segment}','states':[{'id':0,'name':'OBJ_STATE_STOP','animation':animation},{'id':1,'name':'OBJ_STATE_MOVING','animation':animation},{'id':2,'name':'OBJ_STATE_DYING','animation':animation}]}
        level['entities']['backgroundObjects'].append({'id':99+segment,'attributes':{'ini_x':7175-segment*96,'ini_y':512,'width':96,'height':224,'definition':key,'visualScale':4,'skip_num_anims':0,'visible':0}})
    offer={'x':7014,'y':703,'width':123,'height':1,'recursive':0,'onehot':1,'action':'enters','face':'any'}
    level['entities']['triggers']=[
      {'id':1,'attributes':offer,'gameplay':{'conditions':[{'type':'flag','flag':'carrying-object','comparison':'equal','value':True},{'type':'flag','flag':'cocacola-picked','comparison':'equal','value':True},{'type':'flag','flag':'offered-object','comparison':'equal','value':False}],'sequence':'offer-cocacola'}},
      {'id':2,'attributes':{'x':7250,'y':479,'width':299,'height':279,'recursive':1,'onehot':0,'action':'enters','face':'any'},'gameplay':{'conditions':[{'type':'flag','flag':'offered-object','comparison':'equal','value':False}],'actions':[{'type':'emitEvent','event':'killed'}]}},
      {'id':3,'attributes':{'x':4168,'y':581,'width':152,'height':153,'recursive':1,'onehot':0,'action':'enters','face':'any'},'gameplay':{'actions':[{'type':'emitEvent','event':'killed'}]}},
      {'id':4,'attributes':{'x':6373,'y':514,'width':88,'height':213,'recursive':0,'onehot':0,'action':'stays','face':'any','activation':'continuousPoint'},'gameplay':{'actions':[{'type':'setEnemyActive','id':7,'active':False,'reset':True},{'type':'setEnemyActive','id':16,'active':False,'reset':True}]}},
      {'id':5,'attributes':{'x':6461,'y':512,'width':85,'height':214,'recursive':0,'onehot':0,'action':'stays','face':'any','activation':'continuousPoint'},'gameplay':{'actions':[{'type':'setEnemyActive','id':7,'active':True},{'type':'setEnemyActive','id':16,'active':True},{'type':'keepPlayerMoving'}]}},
    ]
    level['definitions']=definitions
    level['combat']['profiles']=[p for p in level['combat']['profiles'] if p['id'].startswith('player-')]+[{'id':f'phase3-enemy-{e["id"]}','faction':'enemies','maxHealth':1,'hurtboxes':[{'id':'body','x':0,'y':0,'width':e['bb_width'],'height':e['bb_height']}],'attacks':[{'id':'contact','states':['CHAR_STATE_RUNNING','CHAR_STATE_STOP'],'x':0,'y':0,'width':e['bb_width'],'height':e['bb_height'],'damageType':'contact','damage':1,'hitOnce':False}],**({'guards':[{'id':'sword-immunity','states':['CHAR_STATE_RUNNING','CHAR_STATE_STOP'],'x':0,'y':0,'width':e['bb_width'],'height':e['bb_height'],'damageTypes':['contact'],'facingOnly':False}]} if e['definition']=='enemies/planta' else {})} for e in enemies]
    fire_steps=[{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':id,'visible':True,'restartAnimation':True}} for id in range(100,105)]+[{'type':'wait','ticks':90}]+[{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':id,'visible':False}} for id in range(100,105)]
    level['gameplay']={'flags':[{'id':'carrying-object','type':'boolean','initial':False},{'id':'cocacola-picked','type':'boolean','initial':False},{'id':'offered-object','type':'boolean','initial':False}],'events':[],'sequences':[{'id':'offer-cocacola','steps':[{'type':'action','action':{'type':'setPlayerMode','visible':True,'controllable':False}},{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':1,'visible':True,'restartAnimation':True}},{'type':'wait','ticks':50},{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':1,'visible':False}},{'type':'action','action':{'type':'setFlag','flag':'carrying-object','value':False}},{'type':'action','action':{'type':'setFlag','flag':'offered-object','value':True}},{'type':'action','action':{'type':'setPlayerMode','visible':True,'controllable':True}}]},{'id':'dragon-fire','steps':fire_steps}]}
    level['objective']={'type':'reachZone','x':7014,'y':703,'width':123,'height':1,'onComplete':'freeze','conditions':[{'type':'flag','flag':'offered-object','comparison':'equal','value':True}]}
    return level

def build_phase4(root, files, phase1):
    phase=phase_values(root,4); world_path=p1.legacy_path(root,phase['world_description']); world,scrolls,triples,width,height=world_dynamic(world_path)
    level=copy.deepcopy(phase1); level['id']='phase-4'; tile_count=(int(world['screen_tiles_x'])//32)*(int(world['screen_tiles_y'])//32)
    tileset=p1.archive_asset(files,world_path.parent/world['file'],'assets/maps/phase-4-tileset.bmp')
    level['map']={'width':width,'height':height,'tileWidth':32,'tileHeight':32,'tileset':{'image':tileset,'tileCount':tile_count,'columns':int(world['screen_tiles_x'])//32,'imageWidth':int(world['screen_tiles_x']),'imageHeight':int(world['screen_tiles_y'])},'layers':{'tiles':[0 if f else g for g,_,f in triples],'frontTiles':[g if f else 0 for g,_,f in triples],'collisions':[p1.collision_gid(c,tile_count) for _,c,_ in triples]}}
    parallax=[]
    for i,s in enumerate(scrolls):
        image=p1.archive_masked_bmp(files,world_path.parent/s['source'],f'assets/maps/phase-4-parallax-{i}.png'); vx=s.get('vel_x',1); vy=s.get('vel_y',1)
        parallax.append({'id':f'phase-4-layer-{i}','image':image,'plane':s['plane'],'factorX':1/vx if s['plane']=='back' else vx,'factorY':1/vy if s['plane']=='back' else vy,'repeatX':True,'repeatY':True})
    level['presentation']={'parallaxLayers':parallax,'messages':[{'id':'telephone-message','text':'La voz del otro mundo','durationTicks':50}],'effects':[]}
    music=p1.archive_asset(files,p1.legacy_path(root,phase['song']),'assets/music/phase-4.wav'); level['audio']['music']=[music]; level['audio']['initialMusic']=0; level['audio']['playback']['initialLoop']=True
    level['runtimeProfile']['characterForms']['initialForm']='primary'; level['runtimeProfile']['capabilities']={'shoot':True,'bomb':True,'hit':True}
    level['entities']={k:[] for k in ['platforms','items','backgroundObjects','blocks','hazards','lasers','triggers','enemies']}
    level['entities']['checkpoints']=p1.parse_checkpoints(p1.legacy_path(root,phase['checkpoint_description']),'left'); level['entities']['cameraViews']=zones_dynamic(p1.legacy_path(root,phase['scrolls']))
    definitions={'characters/player':level['definitions']['characters/player']}; enemies=[]; enemy_defs={}
    for rec in parse_enemy_records_dynamic(p1.legacy_path(root,phase['enemies_description'])):
        name=Path(rec['definition']).stem; key=f'enemies/{name}'
        if key not in enemy_defs:
            bitmap=p1.archive_asset(files,root/'data/characters'/f'{name}.bmp',f'assets/enemies/{name}.bmp'); enemy_defs[key],frame=p1.enemy_definition(root/'data/characters'/rec['definition'],bitmap,1); enemy_defs[key]['frameSize']=frame
        frame=enemy_defs[key]['frameSize']; direction='left' if rec['direction']==1 else 'right'; speed=rec['speed']*4
        if rec['type']==6: behavior={'type':'xyPatrol','distanceX':abs(rec['distanceX']),'distanceY':abs(rec['distanceY']),'stepsPerTick':speed,'initialDirectionX':direction,'initialDirectionY':'up' if rec['state']==2 else 'down','respawnDelayTicks':251}
        elif rec['type']==4 or rec['distanceX']==0: behavior={'type':'idle'}
        else: behavior={'type':'flyPatrol','axis':'horizontal','distance':abs(rec['distanceX']),'phaseTicks':max(1,math.ceil(abs(rec['distanceX'])/speed)),'initialDirection':direction}
        behavior['deathMotion']='stationary'
        enemies.append({'id':rec['id'],'x':rec['x'],'y':rec['y'],'bb_x':0,'bb_y':0,'bb_width':frame['width']*4,'bb_height':frame['height']*4,'direction':direction,'speed_x':speed,'speed_y':speed if rec['type']==6 else 0,'definition':key,'visualScale':4,'combatProfile':f'phase4-enemy-{rec["id"]}','behavior':behavior})
    for definition in enemy_defs.values(): definition.pop('frameSize',None)
    definitions.update(enemy_defs); level['entities']['enemies']=enemies
    bitmap=p1.archive_asset(files,root/'data/objects/telefono.bmp','assets/objects/telephone.bmp'); objdef=p1.object_definition(root/'data/objects/telefono.txt',bitmap); definitions['objects/telephone']=objdef; sprite=objdef['states'][0]['animation']['sprites'][0]
    for obj in parse_objects(p1.legacy_path(root,phase['objects'])):
        attrs={'ini_x':obj['x'],'ini_y':obj['y'],'width':sprite['width']*4,'height':sprite['height']*4,'definition':'objects/telephone','visualScale':4}
        if obj['visible']: level['entities']['items'].append({'id':obj['id'],'attributes':{**attrs,'physics':'fixed'},'onCollect':[{'type':'setFlag','flag':'carrying-object','value':True},{'type':'setFlag','flag':'telephone-picked','value':True},{'type':'showMessage','message':'telephone-message'}]})
        else: level['entities']['backgroundObjects'].append({'id':obj['id'],'attributes':{**attrs,'skip_num_anims':0,'visible':0}})
    # The inactive telephone stands on the floor at y=704. Restrict delivery
    # and completion to its top edge so the scene cannot finish in mid-air.
    offer={'x':2483,'y':703,'width':127,'height':1,'recursive':0,'onehot':1,'action':'enters','face':'any'}
    level['entities']['triggers']=[{'id':1,'attributes':offer,'gameplay':{'conditions':[{'type':'flag','flag':'carrying-object','comparison':'equal','value':True},{'type':'flag','flag':'telephone-picked','comparison':'equal','value':True},{'type':'flag','flag':'offered-object','comparison':'equal','value':False}],'sequence':'offer-telephone'}},{'id':2,'attributes':{'x':2533,'y':434,'width':147,'height':261,'recursive':1,'onehot':0,'action':'enters','face':'any'},'gameplay':{'conditions':[{'type':'flag','flag':'carrying-object','comparison':'equal','value':False},{'type':'flag','flag':'offered-object','comparison':'equal','value':False}],'actions':[{'type':'emitEvent','event':'killed'}]}}]
    level['definitions']=definitions
    level['combat']['profiles']=[p for p in level['combat']['profiles'] if p['id'].startswith('player-')]+[{'id':f'phase4-enemy-{e["id"]}','faction':'enemies','maxHealth':1,'hurtboxes':[{'id':'body','x':0,'y':0,'width':e['bb_width'],'height':e['bb_height']}],'attacks':[{'id':'contact','states':['CHAR_STATE_RUNNING','CHAR_STATE_STOP'],'x':0,'y':0,'width':e['bb_width'],'height':e['bb_height'],'damageType':'contact','damage':1,'hitOnce':False}]} for e in enemies]
    level['gameplay']={'flags':[{'id':'carrying-object','type':'boolean','initial':False},{'id':'telephone-picked','type':'boolean','initial':False},{'id':'offered-object','type':'boolean','initial':False}],'events':[],'sequences':[{'id':'offer-telephone','steps':[{'type':'action','action':{'type':'setPlayerMode','visible':True,'controllable':False}},{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':1,'visible':True,'restartAnimation':True}},{'type':'wait','ticks':50},{'type':'action','action':{'type':'setEntityVisible','entityType':'backgroundObject','id':1,'visible':False}},{'type':'action','action':{'type':'setFlag','flag':'carrying-object','value':False}},{'type':'action','action':{'type':'setFlag','flag':'offered-object','value':True}},{'type':'action','action':{'type':'setPlayerMode','visible':True,'controllable':True}}]}]}
    level['objective']={'type':'reachZone','x':2483,'y':703,'width':127,'height':1,'onComplete':'freeze','conditions':[{'type':'flag','flag':'offered-object','comparison':'equal','value':True}]}
    return level

def convert(legacy_root, output):
    legacy_root=legacy_root.resolve()
    with tempfile.TemporaryDirectory() as td:
        phase1_archive=Path(td)/'phase1.rick2-project'; p1.convert(legacy_root,phase1_archive)
        with ZipFile(phase1_archive) as z: files={n:z.read(n) for n in z.namelist()}; phase1=json.loads(files[p1.LEVEL_PATH]); report=json.loads(files['loss-report.json'])
    phase2=build_phase2(legacy_root,files,phase1); phase3=build_phase3(legacy_root,files,phase1); phase4=build_phase4(legacy_root,files,phase1)
    paths=[p1.LEVEL_PATH,PHASE2_PATH,PHASE3_PATH,PHASE4_PATH]
    final_image='assets/presentation/final.bmp'
    p1.archive_asset(files,legacy_root/'data/intro/final.bmp',final_image)
    manifest={'formatVersion':1,'kind':'rick2.project','id':'camelot','name':'Camelot Warriors','initialLevel':p1.LEVEL_PATH,'levels':paths,'campaign':{'order':paths,'unlockRules':[{'level':path,'requiresCompleted':paths[index-1:index]} for index,path in enumerate(paths)],'completion':{'image':final_image}}}
    files['project.json']=p1.json_bytes(manifest); files['game.json']=p1.json_bytes({'formatVersion':1,'kind':'rick2.game','initialLevel':p1.LEVEL_PATH}); files[PHASE2_PATH]=p1.json_bytes(phase2); files[PHASE3_PATH]=p1.json_bytes(phase3); files[PHASE4_PATH]=p1.json_bytes(phase4)
    phase2_sources=[
      'data/intro/final.bmp','data/levels/phase2.txt','data/maps/world2_transparencia.txt','data/maps/world2_transparencia.bmp',
      'data/maps/fondo_agua.bmp','data/maps/fondo_agua2.bmp','data/characters/enemies_phase2.txt',
      'data/checkpoints/checkpoint_fase2.txt','data/scripts/phase2.txt','data/objects/objects_phase2.txt',
      'data/objects/television.txt','data/objects/television.bmp','data/machinimia/phase2.txt',
      'data/levels/scroll_zones_phase2.txt','data/music/roki.wav',
    ]
    phase2_sources += [f'data/characters/{name}.{ext}' for name in ['bombolles2','pez_azul','caballito_mar','medusa','erizo_mar','pez_rosa','pez_amarillo','pez_verde'] for ext in ['txt','bmp']]
    phase2_sources += ['data/levels/phase3.txt','data/maps/world3_transparencia.txt','data/maps/world3_transparencia.bmp','data/maps/cueva.bmp','data/maps/estalactitas.bmp','data/characters/enemies_phase3.txt','data/checkpoints/checkpoints_fase3.txt','data/scripts/phase3.txt','data/objects/objects_phase3.txt','data/objects/cocacola.txt','data/objects/cocacola.bmp','data/machinimia/phase3.txt','data/levels/scroll_zones_phase3.txt','data/music/progre.wav']
    phase2_sources += [f'data/characters/{name}.{ext}' for name in ['planta','hipopotamo','bolita','bombolla','buho','arana','fuego','estrellita','dragon'] for ext in ['txt','bmp']]
    phase2_sources += ['data/levels/phase4.txt','data/maps/world4_transparencia.txt','data/maps/world4_transparencia.bmp','data/maps/fondo_castillo.bmp','data/characters/enemies_phase4.txt','data/checkpoints/checkpoints_phase4.txt','data/scripts/phase4.txt','data/objects/objects_phase4.txt','data/objects/telefono.txt','data/objects/telefono.bmp','data/machinimia/phase4.txt','data/levels/scroll_zones_phase4.txt','data/music/cmlot.wav']
    phase2_sources += [f'data/characters/{name}.{ext}' for name in ['fuego_candelabro_grande','fuego_candelabro_pequeno','fantasma','rata','buho','hipopotamo','arana','rey_arturo','muro'] for ext in ['txt','bmp']]
    known={entry['path'] for entry in report['inputs']}
    report['inputs'] += [{'path':name,'sha256':hashlib.sha256((legacy_root/name).read_bytes()).hexdigest()} for name in phase2_sources if name not in known]
    report['inputs'].sort(key=lambda entry:entry['path'])
    report['losses']=sorted(report['losses'],key=lambda x:x['code']); files['loss-report.json']=p1.json_bytes(report)
    p1.validate(manifest,phase1,files); p1.validate(manifest,phase2,files); p1.validate(manifest,phase3,files); p1.validate(manifest,phase4,files)
    output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(output,'w') as z:
        for name,data in sorted(files.items()): info=ZipInfo(name,FIXED_DATE); info.compress_type=ZIP_DEFLATED; info.external_attr=0o100644<<16; z.writestr(info,data)
    return report

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--legacy-root',type=Path,default=DEFAULT_LEGACY_ROOT); ap.add_argument('--output',type=Path,default=ROOT/'build/camelot.rick2-project'); args=ap.parse_args(); report=convert(args.legacy_root,args.output); print(f'Created {args.output} with phases 1-4 and {len(report["losses"])} reported losses')
if __name__=='__main__': main()
