#ifndef KEYBOARD_H
#define KEYBOARD_H

#include <allegro5/allegro.h>

#include <iostream>

#define KEY_LEFT  0x001
#define KEY_RIGHT 0x002
#define KEY_UP    0x004
#define KEY_DOWN  0x008
#define KEY_SPACE 0x010
#define KEY_A     0x020
#define KEY_K     0x040
#define KEY_M     0x080
#define KEY_Z     0x100
#define KEY_ESC   0x200

using namespace std;

class Keyboard
{
    private:
      int keys;

    public:
       Keyboard();
       ~Keyboard();

       // Is it possible force a set of keys simultanously
       void SetKeys(int _keys);

       // Read methods
       int  ReadKeyboard(ALLEGRO_EVENT_QUEUE *event_queue);
       int  GetKeys();
       int  PressedLeft();
       int  PressedRight();
       int  PressedUp();
       int  PressedDown();
       int  PressedSpace();
       int  PressedA();
       int  PressedK();
       int  PressedM();
       int  PressedZ();
       int  PressedESC();
};

#endif // KEYBOARD_H
