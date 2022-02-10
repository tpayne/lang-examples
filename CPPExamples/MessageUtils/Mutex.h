///
///   Mutex.h
///   MessengerUtils
///   Created by Tim Payne on 20/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __Mutex_h_
#define __Mutex_h_

#ifndef _WIN32
#include <thread>

typedef pthread_mutex_t MUTEXHANDLE;

#else
#include <process.h>
#include <windows.h>

typedef HANDLE MUTEXHANDLE;

#endif

class Mutex {

public:
  ///
  /// Public interface
  ///
  Mutex();
  ~Mutex();

  inline const MUTEXHANDLE *GetMutexId() { return &m_MutexId; }

  void Lock(void);
  void Unlock(void);

protected:
  ///
  /// Protected interface
  ///

private:
  MUTEXHANDLE m_MutexId;
};

#endif
