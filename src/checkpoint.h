#ifndef CHECKPOINT_H
#define CHECKPOINT_H

#include <stdio.h>
#include <vector>

#include "rick_params.h"

using namespace std;

class Checkpoint {
  private:
    int chk_id;

    // Checkpoint area
    int chk_x;
    int chk_y;
    int chk_width;
    int chk_height;

    // Player coordinates for respawn
    int player_x;
    int player_y;
    int player_face;

    // List of next checkpoints from the current one
    vector<Checkpoint*> next_checkpoints;

  public:
    Checkpoint(int _chk_id,
               int _chk_x, int _chk_y, int _chk_width, int _chk_height,
               int _player_x, int _player_y, int _player_face);
    ~Checkpoint();

    void AddNextCheckpoint(Checkpoint* _next_chk);

    // Read methods
    int GetChkId()     { return chk_id;     }
    int GetChkX()      { return chk_x;      }
    int GetChkY()      { return chk_y;      }
    int GetChkWidth()  { return chk_width;  }
    int GetChkHeight() { return chk_height; }    

    int GetPlayerX()    { return player_x;    }
    int GetPlayerY()    { return player_y;    }
    int GetPlayerFace() { return player_face; }

    vector<Checkpoint*>* GetNextCheckpoints() { return &next_checkpoints; }

    bool InCheckpoint(int x, int y, int width, int height);

};

#endif // CHECKPOINT_H