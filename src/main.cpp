#include <stdio.h>
#include <cstdlib>
#include <fstream>
#include <vector>
#include <memory>
#include <allegro5/allegro.h>
#include <allegro5/allegro_audio.h>
#include <allegro5/allegro_acodec.h>
#include <allegro5/allegro_image.h>
#include <allegro5/allegro_primitives.h>
#include <allegro5/allegro_font.h>
#include <allegro5/allegro_ttf.h>

#include "world.h"
#include "keyboard.h"
#include "camera.h"
#include "player.h"
#include "timer.h"
#include "colbox.h"
#include "object.h"
#include "platform.h"
#include "sound_handler.h"
#include "runtime_options.h"
#include "game_shell.h"

using namespace std;

namespace {
class AllegroSystemGuard {
 public:
  AllegroSystemGuard() : initialized(false) {}
  ~AllegroSystemGuard() {
    if (initialized) {
      al_uninstall_system();
    }
  }

  void MarkInitialized() { initialized = true; }

 private:
  bool initialized;
};

class ResourceCacheGuard {
 public:
  ~ResourceCacheGuard() { ResourceCache::Instance().Clear(); }
};
}

int main(int argc, char *argv[]) {
  std::string level_file;
  RuntimeOptions options;
  unique_ptr<GameShell> game_shell;
  const bool resource_check = getenv("RICK2_RESOURCE_CHECK") != nullptr;
  const char* smoke_ticks_value = getenv("RICK2_SMOKE_TEST_TICKS");
  const unsigned int smoke_tick_limit = smoke_ticks_value
                                            ? strtoul(smoke_ticks_value, nullptr, 10)
                                            : 0;
  unsigned int processed_ticks = 0;
  AllegroSystemGuard allegro_system;
  // Allegro variables
  unique_ptr<ALLEGRO_DISPLAY, void(*)(ALLEGRO_DISPLAY*)> display(nullptr, al_destroy_display);
  unique_ptr<ALLEGRO_BITMAP, void(*)(ALLEGRO_BITMAP*)> bitmap(nullptr, al_destroy_bitmap);
  unique_ptr<ALLEGRO_FONT, void(*)(ALLEGRO_FONT*)> font(nullptr, al_destroy_font);
  unique_ptr<ALLEGRO_EVENT_QUEUE, void(*)(ALLEGRO_EVENT_QUEUE*)> event_queue(nullptr, al_destroy_event_queue);
  Keyboard               keyboard;
  Camera                 camera;
  Timer                  timer;
  SoundHandler           sound_handler;
  ResourceCacheGuard     resource_cache;
  unique_ptr<World>      world;
  unique_ptr<Player>     player;


  try {
    options = ParseRuntimeOptions(argc, argv);
    if (options.show_help) {
      printf("Usage: %s [--debug] [--project project.json | level.json]\n", argv[0]);
      return 0;
    }
    if (!options.project_file.empty()) {
      game_shell.reset(new GameShell(GameShell::FromProject(options.project_file)));
      level_file = game_shell->CurrentLevel();
    } else {
      level_file = options.level_file.empty()
                       ? GetInitialLevelFromGamePackage("../game.json")
                       : options.level_file;
      game_shell.reset(new GameShell(GameShell::DirectLevel(level_file)));
    }
    LoadLevelPackage(level_file.c_str());
  } catch (const std::exception& error) {
    fprintf(stderr, "Startup error: %s\nUsage: %s [--debug] [--project project.json | level.json]\n",
            error.what(), argv[0]);
    return -1;
  }
  const ViewportConfig& display_config = GetDisplayConfig();
  const ViewportConfig& camera_config = GetCameraConfig();

  // allegro initializations
  if(!al_init()) {
    printf("Error: failed to initialize allegro!\n");
    return -1;
  }
  allegro_system.MarkInitialized();

  if(!al_install_keyboard()) {
    printf("Error: failed to initialize keyboard!\n");
    return -1;
  }

  if(options.debug && !al_install_mouse()) {
    printf("Error: failed to initialize mouse!\n");
    return -1;
  }

  al_set_new_display_flags(ALLEGRO_WINDOWED);
  display.reset(al_create_display(display_config.width, display_config.height));
  if(!display) {
    printf("Error: failed to create display!\n");
    return -1;
  }

  if(!al_init_image_addon()) {
    printf("Error: failed to load image addon!\n");
    return -1;
  }

  if (resource_check) {
    // Avoid attributing video-driver allocations to the game during LSan runs.
    al_set_new_bitmap_flags(ALLEGRO_MEMORY_BITMAP);
  }

  bitmap.reset(al_create_bitmap(display_config.width, display_config.height));
  if(!bitmap) {
    printf("Error: failed to create bitmap!\n");
    return -1;
  }

  if(!al_init_primitives_addon()) {
    printf("Error: failed to initialize allegro primitives!\n");
    return -1;
  }

  al_init_font_addon();       // initialize the font addon
  al_init_ttf_addon();        // initialize the ttf (True Type Font) addon

  font.reset(al_load_ttf_font("../fonts/verdana.ttf", 8,0));

  if (!font) {
    printf("Error: Could not load 'pirulen.ttf'\n");
    return -1;
  }

  if(!al_install_audio()) {
    printf("Error: failed to initialize audio!\n");
    return -1;
  }

  if(!al_init_acodec_addon()) {
    printf("Error: failed to initialize audio codecs!\n");
    return -1;
  }

  if(!al_reserve_samples(16)) {  // REVISIT: define this as a param?
    printf("Error: failed to reserve samples!\n");
    return -1;
  }

  al_set_target_bitmap(bitmap.get());
  al_clear_to_color(al_map_rgb(0, 0, 0));
  al_set_target_bitmap(al_get_backbuffer(display.get()));
  al_draw_bitmap(bitmap.get(), 0, 0, 0);
  al_flip_display();

  event_queue.reset(al_create_event_queue());
  if(!event_queue) {
    printf("Error: failted to create event_queue!\n");
    return -1;
  }

  al_register_event_source(event_queue.get(), al_get_keyboard_event_source());

  const auto load_level = [&](const std::string& next_level) {
    player.reset();
    world.reset();
    LoadLevelPackage(next_level.c_str());
    const ViewportConfig& next_display = GetDisplayConfig();
    if (al_get_display_width(display.get()) != next_display.width ||
        al_get_display_height(display.get()) != next_display.height) {
      if (!al_resize_display(display.get(), next_display.width, next_display.height))
        throw DataLoadError("Cannot resize the display for the selected level");
      bitmap.reset(al_create_bitmap(next_display.width, next_display.height));
      if (!bitmap) throw DataLoadError("Cannot create the level render target");
    }
    level_file = next_level;
    world.reset(new World(level_file.c_str(), &sound_handler, false));
    const ViewportConfig& next_camera = GetCameraConfig();
    camera.InitCamera(next_camera.x, next_camera.y,
                      next_camera.width, next_camera.height,
                      world.get(), bitmap.get());
    camera.SetDebugOverlays(options.debug);
    player.reset(new Player(GetPlayerDefinition().c_str()));
    player->RegisterCamera(&camera);
    player->RegisterSoundHandler(&sound_handler);

    // Initialize sounds and start playing music for level 1 (the only implemented at this moment)
    sound_handler.InitializeSounds();
    sound_handler.PlayMusic(GetInitialMusic());
  };

  // Game initializations
  try {
    load_level(level_file);
    const ResourceCacheStats cache_stats = ResourceCache::Instance().GetStats();
    printf("Resource cache: %zu bitmap loads, %zu bitmap hits, "
           "%zu sub-bitmap creations, %zu sub-bitmap hits, "
           "%zu sample loads, %zu sample hits\n",
           cache_stats.bitmap_loads, cache_stats.bitmap_hits,
           cache_stats.sub_bitmap_creations, cache_stats.sub_bitmap_hits,
           cache_stats.sample_loads, cache_stats.sample_hits);
  } catch (const DataLoadError& error) {
    fprintf(stderr, "Game data error: %s\n", error.what());
    return -1;
  } catch (const std::exception& error) {
    fprintf(stderr, "Invalid JSON game data: %s\n", error.what());
    return -1;
  }

  // Allow automated resource checks to load and destroy the complete game
  // state without depending on a working graphical event loop.
  if (resource_check) {
    return 0;
  }

  // Start the fixed 50 Hz simulation clock after loading all resources.
  timer.StartCounter();
  int previous_keys = 0;
  std::size_t selected_level = 0;

  // Main loop
  do {
    const unsigned int simulation_ticks = timer.WaitForSimulationTicks();

    al_set_target_bitmap(bitmap.get());

    keyboard.ReadKeyboard(event_queue.get());
    const int keys = keyboard.GetKeys();
    const int pressed = keys & ~previous_keys;
    previous_keys = keys;
    
    if (options.debug) {
      ALLEGRO_MOUSE_STATE mouse_state;
      al_get_mouse_state(&mouse_state);
      if (mouse_state.buttons & 1) {
        const int world_x = camera.GetPosX() +
            mouse_state.x * camera.GetPixelsWidth() / display_config.width;
        const int world_y = camera.GetPosY() +
            mouse_state.y * camera.GetPixelsHeight() / display_config.height;
        printf("Mouse world coordinates: x=%d, y=%d\n", world_x, world_y);
      }
    }

    if (pressed & KEY_ESC) {
      if (game_shell->Screen() == SHELL_PLAYING && game_shell->IsDirectLevel()) return 0;
      if (game_shell->Screen() == SHELL_MENU || game_shell->Screen() == SHELL_INTRO) return 0;
      game_shell->ShowMenu();
    }

    try {
      if (game_shell->Screen() == SHELL_INTRO && pressed) {
        game_shell->ShowMenu();
      } else if (game_shell->Screen() == SHELL_MENU) {
        if (pressed & KEY_SPACE) load_level(game_shell->NewGame());
        else if (pressed & KEY_A) load_level(game_shell->ContinueGame());
        else if (pressed & KEY_Z) { selected_level = game_shell->ResumeIndex(); game_shell->ShowLevelSelect(); }
      } else if (game_shell->Screen() == SHELL_LEVEL_SELECT) {
        const std::vector<std::string>& order = game_shell->HasCampaign() ? game_shell->CampaignOrder() : game_shell->Levels();
        if ((pressed & KEY_UP) && selected_level) --selected_level;
        if ((pressed & KEY_DOWN) && selected_level + 1 < order.size()) ++selected_level;
        if (pressed & KEY_SPACE) load_level(game_shell->SelectLevel(selected_level));
      } else if (game_shell->Screen() == SHELL_FINISHED && (pressed & KEY_SPACE)) {
        game_shell->ShowMenu();
      }
    } catch (const std::exception& error) {
      fprintf(stderr, "Game shell error: %s\n", error.what());
      return -1;
    }

    for (unsigned int tick = 0; tick < simulation_ticks; ++tick) {
      // Perform a fixed-time step for the world and player. If rendering was
      // briefly delayed, process a bounded number of ticks to catch up.
      if (game_shell->Screen() == SHELL_PLAYING && !(world->IsLevelCompleted() && world->FreezeOnComplete())) {
        world->WorldStep(player.get());
        player->CharacterStep(world.get(), keyboard);
      }
      if (game_shell->Screen() == SHELL_PLAYING && game_shell->HasCampaign() && world->IsLevelCompleted()) {
        try {
          const std::string next_level = game_shell->CompleteCurrentLevel();
          if (!next_level.empty()) load_level(next_level);
        } catch (const std::exception& error) {
          fprintf(stderr, "Level transition error: %s\n", error.what());
          return -1;
        }
      }
      ++processed_ticks;
    }

    if (game_shell->Screen() == SHELL_PLAYING) {
      camera.CameraStep(world.get(), player.get(), font.get());
    } else {
      al_set_target_bitmap(bitmap.get());
      al_clear_to_color(al_map_rgb(8, 12, 20));
      const int center = al_get_bitmap_width(bitmap.get()) / 2;
      if (game_shell->Screen() == SHELL_INTRO) {
        al_draw_text(font.get(), al_map_rgb(245, 200, 66), center, 70, ALLEGRO_ALIGN_CENTER, "RICK2 ENGINE");
        al_draw_text(font.get(), al_map_rgb(220, 220, 220), center, 100, ALLEGRO_ALIGN_CENTER, "Press any key");
      } else if (game_shell->Screen() == SHELL_MENU) {
        al_draw_text(font.get(), al_map_rgb(245, 200, 66), center, 55, ALLEGRO_ALIGN_CENTER, "MAIN MENU");
        al_draw_text(font.get(), al_map_rgb(220, 220, 220), center, 85, ALLEGRO_ALIGN_CENTER, "SPACE  New game");
        al_draw_text(font.get(), al_map_rgb(220, 220, 220), center, 100, ALLEGRO_ALIGN_CENTER, "A      Continue");
        al_draw_text(font.get(), al_map_rgb(220, 220, 220), center, 115, ALLEGRO_ALIGN_CENTER, "Z      Select level");
      } else if (game_shell->Screen() == SHELL_LEVEL_SELECT) {
        al_draw_text(font.get(), al_map_rgb(245, 200, 66), center, 30, ALLEGRO_ALIGN_CENTER, "LEVEL SELECT");
        const std::vector<std::string>& order = game_shell->HasCampaign() ? game_shell->CampaignOrder() : game_shell->Levels();
        for (std::size_t index = 0; index < order.size(); ++index) {
          const ALLEGRO_COLOR color = game_shell->IsUnlocked(order[index]) ? al_map_rgb(220, 220, 220) : al_map_rgb(90, 90, 90);
          const std::string label = std::string(index == selected_level ? "> " : "  ") + "Level " + std::to_string(index + 1) + (game_shell->IsUnlocked(order[index]) ? "" : "  [locked]");
          al_draw_text(font.get(), color, center, 55 + static_cast<int>(index) * 15, ALLEGRO_ALIGN_CENTER, label.c_str());
        }
      } else {
        al_draw_text(font.get(), al_map_rgb(245, 200, 66), center, 75, ALLEGRO_ALIGN_CENTER, "CAMPAIGN COMPLETE");
        al_draw_text(font.get(), al_map_rgb(220, 220, 220), center, 105, ALLEGRO_ALIGN_CENTER, "SPACE  Main menu");
      }
    }

    // Move bitmap into display
    al_set_target_bitmap(al_get_backbuffer(display.get()));
    al_draw_bitmap(bitmap.get(), 0, 0, 0);
    al_flip_display();
    if (smoke_tick_limit && processed_ticks >= smoke_tick_limit) {
      break;
    }
  } while(true);
}
