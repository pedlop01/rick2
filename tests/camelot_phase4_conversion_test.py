#!/usr/bin/env python3
import json, sys, tempfile, unittest
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
import jsonschema
ROOT=Path(__file__).parents[1]; sys.path.insert(0,str(ROOT/'tools'))
from convert_camelot import DEFAULT_LEGACY_ROOT, convert

@unittest.skipUnless(DEFAULT_LEGACY_ROOT.is_dir(),'historical Camelot checkout is not available')
class CamelotPhase4ConversionTest(unittest.TestCase):
 def test_phase4_is_reproducible_complete_and_campaign_ordered(self):
  with tempfile.TemporaryDirectory() as td:
   a=Path(td)/'a.rick2-project'; b=Path(td)/'b.rick2-project'; convert(DEFAULT_LEGACY_ROOT,a); convert(DEFAULT_LEGACY_ROOT,b); self.assertEqual(a.read_bytes(),b.read_bytes())
   with ZipFile(a) as z:
    manifest=json.loads(z.read('project.json')); level=json.loads(z.read('levels/phase-4/level.json'))
    jsonschema.Draft202012Validator(json.loads((ROOT/'schema/project.schema.json').read_text())).validate(manifest)
    jsonschema.Draft202012Validator(json.loads((ROOT/'schema/level.schema.json').read_text())).validate(level)
    self.assertEqual(manifest['campaign']['order'],['levels/phase-1/level.json','levels/phase-2/level.json','levels/phase-3/level.json','levels/phase-4/level.json'])
    self.assertEqual(json.loads(z.read('loss-report.json'))['losses'],[])
    self.assertEqual((level['map']['width'],level['map']['height']),(128,72)); self.assertEqual((level['map']['tileset']['columns'],level['map']['tileset']['tileCount']),(17,289))
    self.assertEqual(Counter(level['map']['layers']['collisions']),Counter({0:8133,290:1060,294:23})); self.assertEqual(sum(bool(cell) for cell in level['map']['layers']['frontTiles']),153)
    self.assertTrue(all(len(layer)==128*72 for layer in level['map']['layers'].values()))
    self.assertEqual(level['runtimeProfile']['characterForms']['initialForm'],'primary'); self.assertTrue(level['runtimeProfile']['capabilities']['hit'])
    self.assertEqual((len(level['entities']['enemies']),len(level['entities']['checkpoints']),len(level['entities']['cameraViews'])),(31,6,1))
    self.assertEqual(Counter(enemy['behavior']['type'] for enemy in level['entities']['enemies']),Counter({'flyPatrol':19,'idle':10,'xyPatrol':2}))
    self.assertEqual(Counter(enemy['definition'] for enemy in level['entities']['enemies'])['enemies/hipopotamo'],8)
    self.assertEqual(level['presentation']['parallaxLayers'][0]['factorX'],1/3); self.assertTrue(level['audio']['playback']['initialLoop'])
    self.assertEqual(level['presentation']['messages'],[{'id':'telephone-message','text':'La voz del otro mundo','durationTicks':50}])
    self.assertEqual((len(level['entities']['items']),len(level['entities']['backgroundObjects'])),(1,1)); self.assertEqual(level['gameplay']['sequences'][0]['steps'][2],{'type':'wait','ticks':50})
    self.assertEqual(level['entities']['triggers'][1]['attributes']['action'],'enters')
    self.assertEqual(level['objective'],{'type':'reachZone','x':2483,'y':703,'width':127,'height':1,'onComplete':'freeze','conditions':[{'type':'flag','flag':'offered-object','comparison':'equal','value':True}]})

if __name__=='__main__': unittest.main()
