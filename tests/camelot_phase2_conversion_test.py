#!/usr/bin/env python3
import hashlib, json, sys, tempfile, unittest
from pathlib import Path
from zipfile import ZipFile
import jsonschema
ROOT=Path(__file__).parents[1]; sys.path.insert(0,str(ROOT/'tools'))
from convert_camelot import DEFAULT_LEGACY_ROOT, convert

@unittest.skipUnless(DEFAULT_LEGACY_ROOT.is_dir(),'historical Camelot checkout is not available')
class CamelotPhase2ConversionTest(unittest.TestCase):
 def test_phase2_is_reproducible_complete_and_campaign_ordered(self):
  with tempfile.TemporaryDirectory() as td:
   a=Path(td)/'a.rick2-project'; b=Path(td)/'b.rick2-project'; convert(DEFAULT_LEGACY_ROOT,a); convert(DEFAULT_LEGACY_ROOT,b); self.assertEqual(a.read_bytes(),b.read_bytes())
   with ZipFile(a) as z:
    manifest=json.loads(z.read('project.json')); level=json.loads(z.read('levels/phase-2/level.json'))
    jsonschema.Draft202012Validator(json.loads((ROOT/'schema/project.schema.json').read_text())).validate(manifest)
    jsonschema.Draft202012Validator(json.loads((ROOT/'schema/level.schema.json').read_text())).validate(level)
    self.assertEqual(manifest['levels'],['levels/phase-1/level.json','levels/phase-2/level.json','levels/phase-3/level.json','levels/phase-4/level.json']); self.assertEqual(manifest['campaign']['order'],manifest['levels'])
    self.assertEqual(manifest['campaign']['completion'],{'image':'assets/presentation/final.bmp'}); self.assertIn('assets/presentation/final.bmp',z.namelist())
    self.assertEqual((level['map']['width'],level['map']['height']),(92,48)); self.assertEqual(set(level['map']['layers']['collisions']),{0,454})
    self.assertTrue(all(len(layer)==92*48 for layer in level['map']['layers'].values()))
    self.assertEqual(level['runtimeProfile']['characterForms']['initialForm'],'alternate'); self.assertFalse(level['runtimeProfile']['capabilities']['hit'])
    self.assertEqual(len(level['entities']['enemies']),18); self.assertEqual(len(level['entities']['checkpoints']),4); self.assertEqual(len(level['entities']['cameraViews']),1)
    self.assertEqual([p['factorX'] for p in level['presentation']['parallaxLayers']],[.2,1/3]); self.assertTrue(level['audio']['playback']['initialLoop'])
    self.assertEqual(len(level['entities']['items']),1); self.assertEqual(len(level['entities']['backgroundObjects']),1)
    self.assertEqual(level['presentation']['messages'],[{'id':'television-message','text':'El espejo de la sabiduria','durationTicks':50}])
    self.assertEqual(level['presentation']['postProcessEffects'],[{'id':'water-distortion','kind':'horizontalStripDisplacement','strips':48,'maxOffset':4,'periodMs':25}])
    self.assertEqual(level['gameplay']['sequences'][0]['id'],'offer-television'); self.assertEqual(level['gameplay']['sequences'][0]['steps'][2],{'type':'wait','ticks':50})
    self.assertEqual(level['map']['tileset']['columns'],15)
    self.assertEqual(level['objective'],{'type':'reachZone','x':2390,'y':1100,'width':292,'height':400,'onComplete':'freeze','conditions':[{'type':'flag','flag':'offered-object','comparison':'equal','value':True}]})
if __name__=='__main__': unittest.main()
