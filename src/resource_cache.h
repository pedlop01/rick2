#ifndef RESOURCE_CACHE_H
#define RESOURCE_CACHE_H

#include <allegro5/allegro.h>
#include <allegro5/allegro_audio.h>

#include <cstddef>
#include <map>
#include <memory>
#include <string>

typedef std::shared_ptr<ALLEGRO_BITMAP> BitmapResource;
typedef std::shared_ptr<ALLEGRO_SAMPLE> SampleResource;

struct ResourceCacheStats {
  std::size_t bitmap_loads;
  std::size_t bitmap_hits;
  std::size_t sub_bitmap_creations;
  std::size_t sub_bitmap_hits;
  std::size_t sample_loads;
  std::size_t sample_hits;
};

class ResourceCache {
 public:
  static ResourceCache& Instance();

  BitmapResource LoadBitmap(const std::string& path);
  BitmapResource LoadSubBitmap(const std::string& source_path,
                               const BitmapResource& source,
                               int x, int y, int width, int height);
  SampleResource LoadSample(const std::string& path);
  ResourceCacheStats GetStats() const;
  void Clear();

 private:
  ResourceCache();
  ResourceCache(const ResourceCache&);
  ResourceCache& operator=(const ResourceCache&);

  std::map<std::string, BitmapResource> bitmaps;
  std::map<std::string, BitmapResource> sub_bitmaps;
  std::map<std::string, SampleResource> samples;
  ResourceCacheStats stats;
};

#endif
