///
///   FileTransferRequests.h
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __filetransferrequests_h__
#define __filetransferrequests_h__

#include <cstring>
#include <string>
#include <vector>

class FileTransfersReq {
public:
  /// Public functions
  FileTransfersReq();
  FileTransfersReq(const std::string &, const std::string &, int cookie = 0,
                   size_t fz = 0);
  FileTransfersReq(const FileTransfersReq &);

  ~FileTransfersReq();

  inline const std::string *GetFile() { return &m_File; }
  inline const std::string *GetUser() { return &m_User; }
  inline const int GetCookie() { return m_Cookie; }
  inline const int GetFileSz() { return m_FileSz; }

  inline void SetFile(const std::string &val) { m_File = val; }
  inline void SetUser(const std::string &val) { m_User = val; }
  inline void SetCookie(int val) { m_Cookie = val; }
  inline void SetFileSz(size_t val) { m_FileSz = val; }

  ///
  /// Overloading some of the operators
  /// needed for list support
  ///

  /// Overloading the == operator
  bool operator==(const FileTransfersReq &other) const;

  /// Overloading the != operator
  bool operator!=(const FileTransfersReq &other) const;

  /// Overloading the = operator
  FileTransfersReq &operator=(const FileTransfersReq &other);

  /// Overloading the > operator
  bool operator>(const FileTransfersReq &other) const;

  /// Overloading the < operator
  bool operator<(const FileTransfersReq &other) const;

private:
  void init();
  void clear();

  std::string m_File;
  std::string m_User;
  int m_Cookie;
  size_t m_FileSz;
};

typedef std::vector<FileTransfersReq> FileTransferRequests;

#endif
