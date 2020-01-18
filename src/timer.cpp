#include "timer.h" // class's header file

// class constructor
Timer::Timer() {
  PCFreq = 0.0;
  CounterStart = 0;
}

// class destructor
Timer::~Timer() {
}

void Timer::StartCounter()
{
#ifdef __WIN32
  LARGE_INTEGER li;
  if(!QueryPerformanceFrequency(&li))
    printf("QueryPerformanceFrequency failed!\n");

  PCFreq = double(li.QuadPart)/1000.0;

  QueryPerformanceCounter(&li);
  CounterStart = li.QuadPart;
#else
  struct timespec gettime_now;
  clock_gettime(CLOCK_REALTIME, &gettime_now);
  CounterStart = gettime_now.tv_nsec;
#endif
}

double Timer::GetCounter()
{
#ifdef __WIN32
  LARGE_INTEGER li;
  QueryPerformanceCounter(&li);

  return double(li.QuadPart-CounterStart)/PCFreq;
#else
  unsigned long time_difference;
  struct timespec gettime_now;
  clock_gettime(CLOCK_REALTIME, &gettime_now);
  time_difference = gettime_now.tv_nsec - CounterStart;

  return (time_difference / 1000000000);
#endif
}
