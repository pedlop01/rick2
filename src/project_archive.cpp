#include "project_archive.h"

#include <cerrno>
#include <cstdio>
#include <cstring>
#include <dirent.h>
#include <fcntl.h>
#include <fstream>
#include <stdexcept>
#include <sys/stat.h>
#include <unistd.h>
#include <vector>
#include <zlib.h>
#include "data_loading.h"

namespace {
const std::size_t MAX_ARCHIVE_SIZE = 256u * 1024u * 1024u;
const std::size_t MAX_ENTRY_SIZE = 128u * 1024u * 1024u;
const std::size_t MAX_TOTAL_SIZE = 512u * 1024u * 1024u;
const std::size_t MAX_ENTRIES = 10000;

unsigned short U16(const std::vector<unsigned char>& data, std::size_t at) {
  if (at + 2 > data.size()) throw DataLoadError("Truncated project archive");
  return static_cast<unsigned short>(data[at] | (data[at + 1] << 8));
}

unsigned int U32(const std::vector<unsigned char>& data, std::size_t at) {
  if (at + 4 > data.size()) throw DataLoadError("Truncated project archive");
  return static_cast<unsigned int>(data[at]) |
      (static_cast<unsigned int>(data[at + 1]) << 8) |
      (static_cast<unsigned int>(data[at + 2]) << 16) |
      (static_cast<unsigned int>(data[at + 3]) << 24);
}

bool SafePath(const std::string& path) {
  if (path.empty() || path[0] == '/' || path.find('\\') != std::string::npos ||
      path.find(':') != std::string::npos || path.size() > 1024) return false;
  std::size_t start = 0;
  while (start < path.size()) {
    const std::size_t slash = path.find('/', start);
    const std::string part = path.substr(start, slash == std::string::npos ? slash : slash - start);
    if (part.empty() || part == "." || part == "..") return false;
    if (slash == std::string::npos) break;
    start = slash + 1;
    if (start == path.size()) break;
  }
  return true;
}

void RemoveTree(const std::string& path) {
  DIR* directory = opendir(path.c_str());
  if (!directory) { unlink(path.c_str()); return; }
  while (dirent* entry = readdir(directory)) {
    const std::string name(entry->d_name);
    if (name == "." || name == "..") continue;
    const std::string child = path + "/" + name;
    struct stat status;
    if (lstat(child.c_str(), &status) == 0 && S_ISDIR(status.st_mode)) RemoveTree(child);
    else unlink(child.c_str());
  }
  closedir(directory);
  rmdir(path.c_str());
}

void MakeParents(const std::string& root, const std::string& path) {
  std::size_t slash = path.find('/');
  while (slash != std::string::npos) {
    const std::string directory = root + "/" + path.substr(0, slash);
    if (mkdir(directory.c_str(), 0700) != 0 && errno != EEXIST)
      throw DataLoadError("Cannot create project directory");
    struct stat status;
    if (lstat(directory.c_str(), &status) != 0 || !S_ISDIR(status.st_mode) || S_ISLNK(status.st_mode))
      throw DataLoadError("Unsafe project directory");
    slash = path.find('/', slash + 1);
  }
}

std::vector<unsigned char> Inflate(const unsigned char* input, std::size_t compressed,
                                   std::size_t expected, unsigned short method) {
  if (expected > MAX_ENTRY_SIZE) throw DataLoadError("Project entry is too large");
  std::vector<unsigned char> output(expected);
  if (method == 0) {
    if (compressed != expected) throw DataLoadError("Invalid stored project entry");
    if (expected) std::memcpy(&output[0], input, expected);
    return output;
  }
  z_stream stream;
  unsigned char empty_output = 0;
  std::memset(&stream, 0, sizeof(stream));
  stream.next_in = const_cast<Bytef*>(input);
  stream.avail_in = static_cast<uInt>(compressed);
  stream.next_out = expected ? &output[0] : &empty_output;
  stream.avail_out = static_cast<uInt>(expected ? expected : 1);
  if (inflateInit2(&stream, -MAX_WBITS) != Z_OK) throw DataLoadError("Cannot initialize ZIP decompression");
  const int result = inflate(&stream, Z_FINISH);
  inflateEnd(&stream);
  if (result != Z_STREAM_END || stream.total_out != expected)
    throw DataLoadError("Invalid compressed project entry");
  return output;
}

void WriteFile(const std::string& root, const std::string& path,
               const std::vector<unsigned char>& bytes) {
  MakeParents(root, path);
  const std::string destination = root + "/" + path;
  const int descriptor = open(destination.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600);
  if (descriptor < 0) throw DataLoadError("Cannot create extracted project file");
  std::size_t written = 0;
  while (written < bytes.size()) {
    const ssize_t count = write(descriptor, &bytes[written], bytes.size() - written);
    if (count <= 0) { close(descriptor); throw DataLoadError("Cannot write extracted project file"); }
    written += static_cast<std::size_t>(count);
  }
  close(descriptor);
}
}

ProjectArchive ProjectArchive::Open(const std::string& archive_path) {
  std::ifstream input(archive_path.c_str(), std::ios::binary | std::ios::ate);
  if (!input) throw DataLoadError("Cannot load '" + archive_path + "'");
  const std::streamoff length = input.tellg();
  if (length < 22 || static_cast<unsigned long long>(length) > MAX_ARCHIVE_SIZE)
    throw DataLoadError("Invalid or oversized project archive");
  std::vector<unsigned char> data(static_cast<std::size_t>(length));
  input.seekg(0); input.read(reinterpret_cast<char*>(&data[0]), length);
  if (!input) throw DataLoadError("Cannot read project archive");

  std::size_t eocd = data.size() - 22;
  const std::size_t search_start = data.size() > 65557 ? data.size() - 65557 : 0;
  while (U32(data, eocd) != 0x06054b50) {
    if (eocd == search_start) throw DataLoadError("Project archive has no ZIP directory");
    --eocd;
  }
  if (eocd + 22u + U16(data, eocd + 20) != data.size())
    throw DataLoadError("Invalid ZIP project footer");
  const unsigned short entries = U16(data, eocd + 10);
  const unsigned int directory_size = U32(data, eocd + 12);
  const unsigned int directory_offset = U32(data, eocd + 16);
  if (U16(data, eocd + 4) || U16(data, eocd + 6) || U16(data, eocd + 8) != entries ||
      entries > MAX_ENTRIES || entries == 0 || directory_offset + directory_size > eocd ||
      entries == 0xffff || directory_offset == 0xffffffffu)
    throw DataLoadError("Unsupported ZIP project archive");

  char temporary[] = "/tmp/rick2-project-XXXXXX";
  char* root_value = mkdtemp(temporary);
  if (!root_value) throw DataLoadError("Cannot create temporary project directory");
  ProjectArchive archive(root_value);
  std::size_t cursor = directory_offset, total_size = 0;
  for (std::size_t entry = 0; entry < entries; ++entry) {
    if (U32(data, cursor) != 0x02014b50) throw DataLoadError("Invalid ZIP project directory");
    const unsigned short flags = U16(data, cursor + 8), method = U16(data, cursor + 10);
    const unsigned int checksum = U32(data, cursor + 16), compressed = U32(data, cursor + 20);
    const unsigned int uncompressed = U32(data, cursor + 24), external = U32(data, cursor + 38);
    const unsigned short name_length = U16(data, cursor + 28), extra_length = U16(data, cursor + 30), comment_length = U16(data, cursor + 32);
    const unsigned int local = U32(data, cursor + 42);
    if (cursor + 46u + name_length + extra_length + comment_length > data.size() ||
        (flags & 1) || (method != 0 && method != 8) || compressed == 0xffffffffu || uncompressed == 0xffffffffu)
      throw DataLoadError("Unsupported project archive entry");
    const std::string name(reinterpret_cast<const char*>(&data[cursor + 46]), name_length);
    if (!SafePath(name) || ((external >> 16) & 0170000) == 0120000)
      throw DataLoadError("Unsafe project archive entry: " + name);
    total_size += uncompressed;
    if (total_size > MAX_TOTAL_SIZE || local + 30 > data.size() || U32(data, local) != 0x04034b50)
      throw DataLoadError("Invalid or oversized project archive entry");
    const unsigned short local_name = U16(data, local + 26), local_extra = U16(data, local + 28);
    const std::size_t content = local + 30u + local_name + local_extra;
    if (content + compressed > directory_offset || U16(data, local + 8) != method ||
        (U16(data, local + 6) & 1) || content > data.size() ||
        std::string(reinterpret_cast<const char*>(&data[local + 30]), local_name) != name)
      throw DataLoadError("Invalid local project archive entry");
    if (!name.empty() && name[name.size() - 1] != '/') {
      const std::vector<unsigned char> bytes = Inflate(&data[content], compressed, uncompressed, method);
      if (crc32(0, bytes.empty() ? Z_NULL : &bytes[0], bytes.size()) != checksum)
        throw DataLoadError("Project archive checksum mismatch");
      WriteFile(archive.root_, name, bytes);
    } else {
      if (compressed || uncompressed) throw DataLoadError("Invalid project directory entry");
      MakeParents(archive.root_, name);
    }
    cursor += 46u + name_length + extra_length + comment_length;
  }
  if (cursor != static_cast<std::size_t>(directory_offset) + directory_size)
    throw DataLoadError("Invalid ZIP project directory size");
  struct stat manifest;
  if (lstat(archive.ManifestPath().c_str(), &manifest) != 0 || !S_ISREG(manifest.st_mode))
    throw DataLoadError("Project archive does not contain project.json");
  return archive;
}

ProjectArchive::ProjectArchive(ProjectArchive&& other) : root_(other.root_) { other.root_.clear(); }
ProjectArchive& ProjectArchive::operator=(ProjectArchive&& other) {
  if (this != &other) { if (!root_.empty()) RemoveTree(root_); root_ = other.root_; other.root_.clear(); }
  return *this;
}
ProjectArchive::~ProjectArchive() { if (!root_.empty()) RemoveTree(root_); }
