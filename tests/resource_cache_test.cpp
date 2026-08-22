#include "../src/resource_cache.h"

#include <allegro5/allegro_image.h>

#include <cassert>
#include <iostream>

int main() {
  assert(al_init());
  assert(al_init_image_addon());
  al_set_new_bitmap_flags(ALLEGRO_MEMORY_BITMAP);

  {
    ResourceCache& cache = ResourceCache::Instance();
    BitmapResource first = cache.LoadBitmap("characters/rick.png");
    BitmapResource second = cache.LoadBitmap("characters/rick.png");
    assert(first && first.get() == second.get());

    BitmapResource first_sprite =
        cache.LoadSubBitmap("characters/rick.png", first, 1, 1, 23, 21);
    BitmapResource second_sprite =
        cache.LoadSubBitmap("characters/rick.png", second, 1, 1, 23, 21);
    assert(first_sprite && first_sprite.get() == second_sprite.get());

    const ResourceCacheStats stats = cache.GetStats();
    assert(stats.bitmap_loads == 1 && stats.bitmap_hits == 1);
    assert(stats.sub_bitmap_creations == 1 && stats.sub_bitmap_hits == 1);
    std::cout << "Resource cache reuses bitmaps and sub-bitmaps" << std::endl;
  }

  ResourceCache::Instance().Clear();
  al_shutdown_image_addon();
  al_uninstall_system();
  return 0;
}
