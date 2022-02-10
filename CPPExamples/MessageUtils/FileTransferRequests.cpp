///
///   FileTransferRequests.cpp
///   MessengerUtils
///   Created by Tim Payne on 18/10/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "FileTransferRequests.h"

#include <iostream>

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Constructors
//   Description:
///   \brief Constructor routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

FileTransfersReq::FileTransfersReq() { init(); }

FileTransfersReq::FileTransfersReq(const std::string &fileName,
                                   const std::string &userName, int cookie,
                                   size_t filesz) {
  init();
  SetFile(fileName);
  SetUser(userName);
  SetCookie(cookie);
  SetFileSz(filesz);
}

FileTransfersReq::FileTransfersReq(const FileTransfersReq &val) {
  init();

  m_File = val.m_File;
  m_User = val.m_User;
  m_Cookie = val.m_Cookie;
  m_FileSz = val.m_FileSz;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Destructors
//   Description:
///   \brief Destructors routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

FileTransfersReq::~FileTransfersReq() { clear(); }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Overrides
//   Description:
///   \brief Operator overrides routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

/// Overloading the == operator
bool FileTransfersReq::operator==(const FileTransfersReq &val) const {
  return (m_Cookie == val.m_Cookie);
}

/// Overloading the != operator
bool FileTransfersReq::operator!=(const FileTransfersReq &other) const {
  return !(*this == other);
}

/// Overloading the = operator
FileTransfersReq &FileTransfersReq::operator=(const FileTransfersReq &val) {
  if (this == &val)
    return *this;

  m_File = val.m_File;
  m_User = val.m_User;
  m_Cookie = val.m_Cookie;
  m_FileSz = val.m_FileSz;

  return *this;
}

/// Overloading the > operator
bool FileTransfersReq::operator>(const FileTransfersReq &other) const {
  return (m_Cookie > other.m_Cookie);
}

/// Overloading the != operator
bool FileTransfersReq::operator<(const FileTransfersReq &other) const {
  return (m_Cookie < other.m_Cookie);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   clear
//   Description:
///   \brief clear the class
//   Parameters:
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void FileTransfersReq::clear() {
  init();
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   init
//   Description:
///   \brief init the class
//   Parameters:
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void FileTransfersReq::init() {
  m_Cookie = 0;
  m_FileSz = 0;
  return;
}
