#include "../src/container_utils.h"

#include <iostream>
#include <list>

struct Probe {
  explicit Probe(int value) : id(value) {}
  int GetTypeId() const { return id; }
  int id;
};

int main() {
  std::list<Probe*> probes;
  probes.push_back(new Probe(1));
  probes.push_back(new Probe(2));
  probes.push_back(new Probe(3));
  probes.push_back(new Probe(4));

  int disposed = 0;
  const std::size_t erased = EraseAndDisposeIf(
      probes,
      [](Probe* probe) { return probe->id <= 3; },
      [&disposed](Probe* probe) {
        ++disposed;
        delete probe;
      });

  if (erased != 3 || disposed != 3 || probes.size() != 1 ||
      probes.front()->id != 4) {
    std::cerr << "Consecutive erase test failed" << std::endl;
    return 1;
  }

  const std::size_t erased_last = EraseAndDisposeIf(
      probes,
      [](Probe*) { return true; },
      [&disposed](Probe* probe) {
        ++disposed;
        delete probe;
      });

  if (erased_last != 1 || disposed != 4 || !probes.empty()) {
    std::cerr << "Final-element erase test failed" << std::endl;
    return 1;
  }

  Probe first(7), second(0);
  std::list<Probe*> authored_ids = {&first, &second};
  if (FindByTypeId(authored_ids, 0) != &second ||
      FindByTypeId(authored_ids, 9) != nullptr) {
    std::cerr << "Authored entity ID lookup test failed" << std::endl;
    return 1;
  }

  std::cout << "Consecutive entity removal passed" << std::endl;
  return 0;
}
