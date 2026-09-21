#!/usr/bin/env python3
import json, sys, tempfile, unittest
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
import jsonschema
ROOT=Path(__file__).parents[1]; sys.path.insert(0,str(ROOT/'tools'))
from convert_camelot import DEFAULT_LEGACY_ROOT, convert

@unittest.skipUnless(DEFAULT_LEGACY_ROOT.is_dir(),'historical Camelot checkout is not available')
class CamelotPhase3ConversionTest(unittest.TestCase):
 def test_phase3_is_reproducible_complete_and_campaign_ordered(self):
  with tempfile.TemporaryDirectory() as td:
   a=Path(td)/'a.rick2-project'; b=Path(td)/'b.rick2-project'; convert(DEFAULT_LEGACY_ROOT,a); convert(DEFAULT_LEGACY_ROOT,b); self.assertEqual(a.read_bytes(),b.read_bytes())
   with ZipFile(a) as z:
    manifest=json.loads(z.read('project.json')); level=json.loads(z.read('levels/phase-3/level.json'))
    jsonschema.Draft202012Validator(json.loads((ROOT/'schema/project.schema.json').read_text())).validate(manifest)
    jsonschema.Draft202012Validator(json.loads((ROOT/'schema/level.schema.json').read_text())).validate(level)
    self.assertEqual(manifest['campaign']['order'],['levels/phase-1/level.json','levels/phase-2/level.json','levels/phase-3/level.json'])
    self.assertEqual((level['map']['width'],level['map']['height']),(236,24)); self.assertEqual(level['map']['tileset']['columns'],22)
    self.assertEqual(Counter(level['map']['layers']['collisions']),Counter({0:4929,454:735}))
    self.assertTrue(all(len(layer)==236*24 for layer in level['map']['layers'].values()))
    forms=level['runtimeProfile']['characterForms']; self.assertEqual(forms['initialForm'],'primary'); self.assertIn(forms['initialForm'],[form['id'] for form in forms['forms']]); self.assertTrue(level['runtimeProfile']['capabilities']['hit'])
    self.assertTrue(all(form['controller']['ceilingEndsAscent'] is False for form in forms['forms']))
    self.assertEqual(len(level['entities']['enemies']),16); self.assertEqual(len(level['entities']['checkpoints']),6); self.assertEqual(len(level['entities']['cameraViews']),2)
    self.assertEqual(level['entities']['enemies'][-1]['behavior'],{'type':'proximityAttack','activationDistance':1024,'delayTicks':250,'durationTicks':90,'sequence':'dragon-fire','idleAnimation':'CHAR_STATE_STOP','attackAnimation':'CHAR_STATE_RUNNING','deathMotion':'stationary'})
    plant=level['combat']['profiles'][2]; self.assertEqual(plant['guards'][0]['id'],'sword-immunity')
    self.assertEqual([p['plane'] for p in level['presentation']['parallaxLayers']],['back','front']); self.assertTrue(level['audio']['playback']['initialLoop'])
    self.assertEqual(len(level['entities']['items']),1); self.assertEqual(len(level['entities']['backgroundObjects']),6)
    water=next(trigger for trigger in level['entities']['triggers'] if trigger['id']==3); self.assertEqual(water['attributes']['action'],'enters'); self.assertEqual(water['gameplay']['actions'],[{'type':'emitEvent','event':'killed'}])
    self.assertEqual(level['gameplay']['sequences'][0]['id'],'offer-cocacola'); self.assertEqual(level['gameplay']['sequences'][0]['steps'][2],{'type':'wait','ticks':50})
    self.assertEqual(level['gameplay']['sequences'][1]['id'],'dragon-fire'); self.assertEqual(level['gameplay']['sequences'][1]['steps'][0]['action']['visible'],True)
    self.assertEqual((level['objective']['y'],level['objective']['height']),(703,1)); self.assertEqual(level['objective']['conditions'],[{'type':'flag','flag':'offered-object','comparison':'equal','value':True}])

if __name__=='__main__': unittest.main()
