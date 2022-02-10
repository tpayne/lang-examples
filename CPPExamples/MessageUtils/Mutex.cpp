///
///   Mutex.cpp
///   MessengerUtils
///   Created by Tim Payne on 20/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "Mutex.h"

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Constructors
//   Description:
///   Constructor routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

Mutex::Mutex() {
#ifndef _WIN32
  pthread_mutex_init(&m_MutexId, NULL);
#else
  m_MutexId = CreateMutex(NULL, FALSE, NULL);
#endif
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Destructors
//   Description:
///   Destructors routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

Mutex::~Mutex() {
  Unlock();
#ifdef _WIN32
  CloseHandle(m_MutexId);
#endif
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Lock
//   Description:
///   Lock mutex
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void Mutex::Lock() {
#ifndef _WIN32
  pthread_mutex_lock(&m_MutexId);
#else
  WaitForSingleObject(m_MutexId, INFINITE);
#endif
  return;
}
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Unlock
//   Description:
///   Unlock mutex
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void Mutex::Unlock() {
#ifndef _WIN32
  pthread_mutex_unlock(&m_MutexId);
#else
  ReleaseMutex(m_MutexId);
#endif
  return;
}