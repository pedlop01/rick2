#ifndef PROJECT_ARCHIVE_H
#define PROJECT_ARCHIVE_H

#include <string>

class ProjectArchive {
 public:
  static ProjectArchive Open(const std::string& archive_path);
  ProjectArchive(ProjectArchive&& other);
  ProjectArchive& operator=(ProjectArchive&& other);
  ~ProjectArchive();

  const std::string& Root() const { return root_; }
  std::string ManifestPath() const { return root_ + "/project.json"; }

 private:
  explicit ProjectArchive(const std::string& root) : root_(root) {}
  ProjectArchive(const ProjectArchive&);
  ProjectArchive& operator=(const ProjectArchive&);
  std::string root_;
};

#endif
