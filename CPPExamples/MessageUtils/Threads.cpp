///
///   Threads.cpp
///   MessengerUtils
///   Created by Tim Payne on 13/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "Threads.h"

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

Threads::Threads() { init(); }

Threads::Threads(CALLBACKFUNCPTR func, void *param) {
  init();
  SetFunction(func);
  SetParam(param);
}

Threads::Threads(const Threads &val) {
  init();

  m_ThreadId = val.m_ThreadId;
  m_ThreadHandle = val.m_ThreadHandle;
  m_Callback = val.m_Callback;
#ifdef _WIN32
  m_Pta = val.m_Pta;
#else
  int ins = 0;
  (void)pthread_attr_getinheritsched(&val.m_Pta, &ins);
  (void)pthread_attr_setinheritsched(&m_Pta, ins);
  struct sched_param param = {0};
  (void)pthread_attr_getschedparam(&val.m_Pta, &param);
  (void)pthread_attr_setschedparam(&m_Pta, &param);
  int policy = 0;
  (void)pthread_attr_getschedpolicy(&val.m_Pta, &policy);
  (void)pthread_attr_setschedpolicy(&m_Pta, policy);
  int scope = 0;
  (void)pthread_attr_getscope(&val.m_Pta, &scope);
  (void)pthread_attr_setscope(&m_Pta, scope);
  size_t stack = 0;
  (void)pthread_attr_getstacksize(&val.m_Pta, &stack);
  (void)pthread_attr_setstacksize(&m_Pta, stack);

  void *stackAddrx = 0;
  size_t v = 0;
  (void)pthread_attr_getstack(&val.m_Pta, &stackAddrx, &v);
  (void)pthread_attr_setstack(&m_Pta, stackAddrx, v);
  //(void)pthread_attr_getstackaddr(&val.m_Pta, &stackAddrx);
  //(void)pthread_attr_setstackaddr(&m_Pta, stackAddrx);

  int detached = 0;
  (void)pthread_attr_getdetachstate(&val.m_Pta, &detached);
  (void)pthread_attr_setdetachstate(&m_Pta, detached);
#endif
  m_Param = val.m_Param;
  m_Started = val.m_Started;
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

Threads::~Threads() {
  clear();
  if (m_Started) {
#ifndef _WIN32
    pthread_cancel(m_ThreadId);
    pthread_exit(EXIT_SUCCESS);
#else
    CloseHandle(m_ThreadHandle);
    _endthreadex(EXIT_SUCCESS);
#endif
  }
}

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
bool Threads::operator==(const Threads &val) const {
  return (m_ThreadId == val.m_ThreadId &&
          m_ThreadHandle == val.m_ThreadHandle &&
          m_Callback == val.m_Callback && m_Param == val.m_Param);
}

/// Overloading the != operator
bool Threads::operator!=(const Threads &other) const {
  return !(*this == other);
}

/// Overloading the = operator
Threads &Threads::operator=(const Threads &val) {
  if (this == &val)
    return *this;

  m_ThreadId = val.m_ThreadId;
  m_ThreadHandle = val.m_ThreadHandle;
  m_Callback = val.m_Callback;
#ifdef _WIN32
  m_Pta = val.m_Pta;
#else
  int ins = 0;
  (void)pthread_attr_getinheritsched(&val.m_Pta, &ins);
  (void)pthread_attr_setinheritsched(&m_Pta, ins);
  struct sched_param param = {0};
  (void)pthread_attr_getschedparam(&val.m_Pta, &param);
  (void)pthread_attr_setschedparam(&m_Pta, &param);
  int policy = 0;
  (void)pthread_attr_getschedpolicy(&val.m_Pta, &policy);
  (void)pthread_attr_setschedpolicy(&m_Pta, policy);
  int scope = 0;
  (void)pthread_attr_getscope(&val.m_Pta, &scope);
  (void)pthread_attr_setscope(&m_Pta, scope);
  size_t stack = 0;
  (void)pthread_attr_getstacksize(&val.m_Pta, &stack);
  (void)pthread_attr_setstacksize(&m_Pta, stack);
  void *stackAddrx = 0;
  size_t v = 0;
  (void)pthread_attr_getstack(&val.m_Pta, &stackAddrx, &v);
  (void)pthread_attr_setstack(&m_Pta, stackAddrx, v);
  //(void)pthread_attr_getstackaddr(&val.m_Pta, &stackAddrx);
  //(void)pthread_attr_setstackaddr(&m_Pta, stackAddrx);
  int detached = 0;
  (void)pthread_attr_getdetachstate(&val.m_Pta, &detached);
  (void)pthread_attr_setdetachstate(&m_Pta, detached);
#endif
  m_Param = val.m_Param;
  m_Started = val.m_Started;

  return *this;
}

/// Overloading the > operator
bool Threads::operator>(const Threads &other) const {
  return (m_ThreadId > other.m_ThreadId);
}

/// Overloading the != operator
bool Threads::operator<(const Threads &other) const {
  return (m_ThreadId < other.m_ThreadId);
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

void Threads::clear() {
#ifndef _WIN32
  (void)pthread_attr_destroy(&m_Pta);
#else
  CloseHandle(m_ThreadHandle);
#endif
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

void Threads::init() {
#ifndef _WIN32
  (void)pthread_attr_init(&m_Pta);
#endif
  m_ThreadId = 0;
  m_ThreadHandle = 0;
  m_Callback = 0;
  m_Started = false;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   SetAttribute
//   Description:
///   \brief Set a thread attribute
//   Parameters:
///   @param int
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

int Threads::SetAttribute(int attr) {
#ifndef _WIN32 /// Thread attributes are not supported by _WIN32
  if (attr == PTHREAD_CREATE_JOINABLE || attr == PTHREAD_CREATE_DETACHED)
    return (pthread_attr_setdetachstate(&m_Pta, attr));
  else if (attr == PTHREAD_EXPLICIT_SCHED || attr == PTHREAD_INHERIT_SCHED)
    return (pthread_attr_setinheritsched(&m_Pta, attr));
#endif
  return (-1);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Start
//   Description:
///   \brief Start a thread
//   Parameters:
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

int Threads::Start() {
#ifndef _WIN32
  int rc = pthread_create(&m_ThreadId, &m_Pta, m_Callback, m_Param);
  m_ThreadHandle = m_ThreadId;
  if (rc == 0) {
    int old = 0;
    (void)pthread_setcanceltype(PTHREAD_CANCEL_ASYNCHRONOUS, &old);
    (void)pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, &old);
    (void)pthread_detach(m_ThreadId);
  }
  m_Started = true;
  return rc;
#else
  int rc = 0;
  m_ThreadHandle =
      (HANDLE)_beginthreadex(NULL, 0, m_Callback, m_Param, 0, &m_ThreadId);
  m_Started = true;
  return rc;
#endif
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Stop
//   Description:
///   \brief stop a thread
//   Parameters:
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

int Threads::Stop() {
  int rc = 0;
  if (m_Started) {
#ifndef _WIN32
    if (pthread_cancel(m_ThreadId) == 0)
      rc = pthread_join(m_ThreadId, NULL);
#else
    CloseHandle(m_ThreadHandle);
    _endthreadex(EXIT_SUCCESS);
#endif
  }
  return rc;
}
