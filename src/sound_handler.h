#ifndef SOUND_HANDLER_H
#define SOUND_HANDLER_H

#include <stdio.h>
#include <iostream>
#include <allegro5/allegro.h>
#include <allegro5/allegro_audio.h>
#include <allegro5/allegro_acodec.h>

#include "rick_params.h"

#define NUM_SONGS  1
#define NUM_FXS   16

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
    ALLEGRO_SAMPLE* music[NUM_SONGS];
    ALLEGRO_SAMPLE* fx[NUM_FXS];
    ALLEGRO_SAMPLE_INSTANCE* music_instance[NUM_SONGS];
    ALLEGRO_SAMPLE_ID fx_id[NUM_FXS];

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