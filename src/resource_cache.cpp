#include "resource_cache.h"

#include <sstream>

ResourceCache::ResourceCache() : stats{0, 0, 0, 0, 0, 0} {}

ResourceCache& ResourceCache::Instance() {
  static ResourceCache cache;
  return cache;
}

BitmapResource ResourceCache::LoadBitmap(const std::string& path) {
  BitmapResource cached = bitmaps[path];
  if (cached) {
    ++stats.bitmap_hits;
    return cached;
  }
  ALLEGRO_BITMAP* bitmap = al_load_bitmap(path.c_str());
  if (!bitmap) {
    bitmaps.erase(path);
    return BitmapResource();
  }
  al_convert_mask_to_alpha(bitmap, al_map_rgb(255, 0, 255));
  BitmapResource resource(bitmap, al_destroy_bitmap);
  bitmaps[path] = resource;
  ++stats.bitmap_loads;
  return resource;
}

BitmapResource ResourceCache::LoadSubBitmap(const std::string& source_path,
                                            const BitmapResource& source,
                                            int x, int y, int width, int height) {
  std::ostringstream key_builder;
  key_builder << source_path << ':' << x << ':' << y << ':' << width << ':' << height;
  const std::string key = key_builder.str();
  BitmapResource cached = sub_bitmaps[key];
  if (cached) {
    ++stats.sub_bitmap_hits;
    return cached;
  }
  ALLEGRO_BITMAP* bitmap = source ?
      al_create_sub_bitmap(source.get(), x, y, width, height) : nullptr;
  if (!bitmap) {
    sub_bitmaps.erase(key);
    return BitmapResource();
  }
  // Animations retain their source bitmap while destroying their sprites, so
  // every sub-bitmap is released before its parent without extending the
  // parent's lifetime into the cache's static weak control blocks.
  BitmapResource resource(bitmap, al_destroy_bitmap);
  sub_bitmaps[key] = resource;
  ++stats.sub_bitmap_creations;
  return resource;
}

SampleResource ResourceCache::LoadSample(const std::string& path) {
  SampleResource cached = samples[path];
  if (cached) {
    ++stats.sample_hits;
    return cached;
  }
  ALLEGRO_SAMPLE* sample = al_load_sample(path.c_str());
  if (!sample) {
    samples.erase(path);
    return SampleResource();
  }
  SampleResource resource(sample, al_destroy_sample);
  samples[path] = resource;
  ++stats.sample_loads;
  return resource;
}

ResourceCacheStats ResourceCache::GetStats() const {
  return stats;
}

void ResourceCache::Clear() {
  // Allegro sub-bitmaps must be destroyed before their parent bitmaps.
  sub_bitmaps.clear();
  bitmaps.clear();
  samples.clear();
}
