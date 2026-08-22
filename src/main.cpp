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
  ALLEGRO_MOUSE_STATE    mouse_state;
  Keyboard               keyboard;
  Camera                 camera;
  Timer                  timer;
  SoundHandler           sound_handler;
  ResourceCacheGuard     resource_cache;
  unique_ptr<World>      world;
  unique_ptr<Player>     player;


  // Check arguments
  if(argc > 2) {
    printf("Usage: %s [level.json]\n", argv[0]);
    exit(-1);
  }

  try {
    level_file = argc == 2 ? argv[1] :
                            GetInitialLevelFromGamePackage("../game.json");
    LoadLevelPackage(level_file.c_str());
  } catch (const std::exception& error) {
    fprintf(stderr, "Game data error: %s\n", error.what());
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

  if(!al_install_mouse()) {
    printf("Error: failed to initialize keyboard!\n");
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

  // Game initializations
  try {
    world.reset(new World(level_file.c_str(), &sound_handler, false));
    camera.InitCamera(camera_config.x, camera_config.y,
                      camera_config.width, camera_config.height,
                      world.get(), bitmap.get());
    player.reset(new Player(GetPlayerDefinition().c_str()));
    player->RegisterCamera(&camera);
    player->RegisterSoundHandler(&sound_handler);

    // Initialize sounds and start playing music for level 1 (the only implemented at this moment)
    sound_handler.InitializeSounds();
    sound_handler.PlayMusic(GetInitialMusic());
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

  // Main loop
  do {
    const unsigned int simulation_ticks = timer.WaitForSimulationTicks();

    al_set_target_bitmap(bitmap.get());

    keyboard.ReadKeyboard(event_queue.get());
    
    // REVISIT: added mouse to combine creation with main game
    al_get_mouse_state(&mouse_state);
    if (mouse_state.buttons & 1)
      printf("Mouse coord x = %d, y = %d\n", camera.GetPosX() + mouse_state.x/2, camera.GetPosY() + mouse_state.y/2);

    if(keyboard.PressedESC())   { return 0; }

    for (unsigned int tick = 0; tick < simulation_ticks; ++tick) {
      // Perform a fixed-time step for the world and player. If rendering was
      // briefly delayed, process a bounded number of ticks to catch up.
      world->WorldStep(player.get());
      player->CharacterStep(world.get(), keyboard);
      ++processed_ticks;
    }

    //printf("[Main] Camera positioning and drawing\n");
    camera.CameraStep(world.get(), player.get(), font.get());

    // Move bitmap into display
    al_set_target_bitmap(al_get_backbuffer(display.get()));
    al_draw_bitmap(bitmap.get(), 0, 0, 0);
    al_flip_display();
    if (smoke_tick_limit && processed_ticks >= smoke_tick_limit) {
      break;
    }
  } while(true);
}
