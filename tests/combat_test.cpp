#include "../src/combat.h"
#include <cassert>

int main() {
  const nlohmann::json definition = nlohmann::json::parse(R"({"damageTypes":[{"id":"melee"}],"profiles":[{"id":"hero","faction":"a","maxHealth":3,"hurtboxes":[{"id":"body","x":0,"y":0,"width":10,"height":10}],"attacks":[{"id":"sword","states":["attack"],"frames":[1],"x":8,"y":0,"width":8,"height":10,"damageType":"melee","damage":1,"knockbackX":2}]},{"id":"guard","faction":"b","maxHealth":2,"hurtboxes":[{"id":"body","x":0,"y":0,"width":10,"height":10}],"guards":[{"id":"shield","states":["guard"],"x":0,"y":0,"width":10,"height":10,"damageTypes":["melee"]}]}]})");
  CombatCatalog catalog(definition); CombatantState hero(catalog.Find("hero")), guard(catalog.Find("guard")); CombatPose attack = { 0, 0, 20, false, "attack", 1, 1 }, defending = { 9, 0, 10, true, "guard", 0, 1 }; CombatHit hit;
  assert(ResolveCombat(hero, attack, guard, defending, &hit)); assert(hit.blocked); assert(guard.Health() == 2); assert(!ResolveCombat(hero, attack, guard, defending, &hit));
  defending.state = "idle"; attack.activation = 2; assert(ResolveCombat(hero, attack, guard, defending, &hit)); assert(hit.applied); assert(hit.knockback_x == 2); assert(guard.Health() == 1);
  attack.facing_left = true; attack.x = 10; attack.activation = 3; defending.x = 1; assert(ActiveAttackboxes(*hero.Profile(), attack)[0].x == 14); return 0;
}
