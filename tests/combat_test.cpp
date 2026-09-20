#include "../src/combat.h"
#include <cassert>

int main() {
  const nlohmann::json definition = nlohmann::json::parse(R"({"damageTypes":[{"id":"melee"}],"profiles":[{"id":"hero","faction":"a","maxHealth":3,"hurtboxes":[{"id":"body","x":0,"y":0,"width":10,"height":10}],"attacks":[{"id":"sword","states":["attack"],"frames":[1],"x":8,"y":0,"width":8,"height":10,"damageType":"melee","damage":1,"knockbackX":2}]},{"id":"guard","faction":"b","maxHealth":2,"hurtboxes":[{"id":"body","x":0,"y":0,"width":10,"height":10}],"guards":[{"id":"shield","states":["guard"],"x":0,"y":0,"width":10,"height":10,"damageTypes":["melee"]}]}]})");
  CombatCatalog catalog(definition); CombatantState hero(catalog.Find("hero")), guard(catalog.Find("guard")); CombatPose attack = { 0, 0, 20, false, "attack", 1, 1 }, defending = { 9, 0, 10, true, "guard", 0, 1 }; CombatHit hit;
  assert(ResolveCombat(hero, attack, guard, defending, &hit)); assert(hit.blocked); assert(guard.Health() == 2); assert(!ResolveCombat(hero, attack, guard, defending, &hit));
  defending.state = "idle"; attack.activation = 2; assert(ResolveCombat(hero, attack, guard, defending, &hit)); assert(hit.applied); assert(hit.knockback_x == 2); assert(guard.Health() == 1);
  attack.facing_left = true; attack.x = 10; attack.activation = 3; defending.x = 1; assert(ActiveAttackboxes(*hero.Profile(), attack)[0].x == 14);

  const nlohmann::json historical_contact = nlohmann::json::parse(R"({"damageTypes":[{"id":"contact"}],"profiles":[{"id":"player","faction":"player","maxHealth":1,"hurtboxes":[{"id":"body","x":25,"y":25,"width":14,"height":95}]},{"id":"enemy","faction":"enemies","maxHealth":1,"hurtboxes":[{"id":"body","x":0,"y":0,"width":64,"height":71}],"attacks":[{"id":"contact","states":["CHAR_STATE_RUNNING"],"x":0,"y":0,"width":64,"height":71,"damageType":"contact","damage":1}]}]})");
  CombatCatalog contact_catalog(historical_contact); CombatantState enemy(contact_catalog.Find("enemy")), player(contact_catalog.Find("player"));
  CombatPose enemy_pose = { 25, 100, 64, false, "CHAR_STATE_RUNNING", 0, 1 }, player_pose = { 0, 0, 64, false, "walking", 0, 1 };
  assert(ResolveCombat(enemy, enemy_pose, player, player_pose, &hit)); assert(hit.applied); assert(!player.Alive());
  const nlohmann::json sword_definition = nlohmann::json::parse(R"({"damageTypes":[{"id":"contact"}],"profiles":[{"id":"player","faction":"player","maxHealth":1,"hurtboxes":[{"id":"body","x":25,"y":25,"width":14,"height":95}],"attacks":[{"id":"melee","states":["golpear"],"frames":[0],"x":64,"y":24,"width":64,"height":28,"damageType":"contact","damage":1}]},{"id":"enemy","faction":"enemies","maxHealth":1,"hurtboxes":[{"id":"body","x":0,"y":0,"width":64,"height":20}]}]})");
  CombatCatalog sword_catalog(sword_definition); CombatantState sword(sword_catalog.Find("player")), target(sword_catalog.Find("enemy")); CombatPose sword_pose = { 0, 0, 64, false, "golpear", 0, 1 }, target_pose = { 80, 60, 64, true, "CHAR_STATE_RUNNING", 0, 1 }; assert(!ResolveCombat(sword, sword_pose, target, target_pose, &hit)); target_pose.y = 30; sword_pose.activation = 2; assert(ResolveCombat(sword, sword_pose, target, target_pose, &hit)); assert(!target.Alive());
  const nlohmann::json repeat_definition = nlohmann::json::parse(R"({"damageTypes":[{"id":"contact"}],"profiles":[{"id":"player","faction":"player","maxHealth":1,"hurtboxes":[{"id":"body","x":0,"y":0,"width":10,"height":10}]},{"id":"enemy","faction":"enemies","maxHealth":1,"hurtboxes":[{"id":"body","x":0,"y":0,"width":10,"height":10}],"attacks":[{"id":"contact","states":["idle"],"x":0,"y":0,"width":10,"height":10,"damageType":"contact","damage":1,"hitOnce":false}],"guards":[{"id":"immune","states":["idle"],"x":0,"y":0,"width":10,"height":10,"damageTypes":["contact"],"facingOnly":false}]}]})");
  CombatCatalog repeat_catalog(repeat_definition); CombatantState repeated_enemy(repeat_catalog.Find("enemy")), repeated_player(repeat_catalog.Find("player")); CombatPose repeated_enemy_pose = { 0, 0, 10, false, "idle", 0, 1 }, repeated_player_pose = { 0, 0, 10, false, "walk", 0, 1 };
  assert(ResolveCombat(repeated_enemy, repeated_enemy_pose, repeated_player, repeated_player_pose, &hit) && hit.applied);
  repeated_player.Reset();
  assert(ResolveCombat(repeated_enemy, repeated_enemy_pose, repeated_player, repeated_player_pose, &hit) && hit.applied);
  repeated_player.Reset();
  repeated_enemy_pose.x = 80; repeated_enemy_pose.y = 40; sword_pose.activation = 3;
  assert(ResolveCombat(sword, sword_pose, repeated_enemy, repeated_enemy_pose, &hit));
  assert(hit.blocked && repeated_enemy.Alive());
  return 0;
}
