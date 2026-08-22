#ifndef SOUND_HANDLER_H
#define SOUND_HANDLER_H

#include <stdio.h>
#include <iostream>
#include <vector>
#include <allegro5/allegro.h>
#include <allegro5/allegro_audio.h>
#include <allegro5/allegro_acodec.h>

#include "rick_params.h"
#include "data_loading.h"
#include "json_level_loader.h"
#include "resource_cache.h"

#define FX_WALK      0
#define FX_SHOT      1
#define FX_BOMB      2
#define FX_SCREAM    3
#define FX_BONUS     4
#define FX_RING      5
#define FX_EXPLOSION 6

class SoundHandler
{
  private:
    std::vector<SampleResource> music;
    std::vector<SampleResource> fx;
    std::vector<ALLEGRO_SAMPLE_INSTANCE*> music_instance;
    std::vector<ALLEGRO_SAMPLE_ID> fx_id;

    int playing_music_id;

  public:
    SoundHandler();
    ~SoundHandler();

    void InitializeSounds();
    void PlayMusic(int id);
    void PlaySound(int id, bool loop);
    void StopSound(int id);
};

#endif // SOUND_HANDLER
