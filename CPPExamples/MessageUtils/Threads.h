///
///   Threads.h
///   MessengerUtils
///   Created by Tim Payne on 13/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __Threads_h_
#define __Threads_h_

#include <cstring>

#ifndef _WIN32
#include <thread>
#else
#include <process.h>
#include <windows.h>
#endif

#ifndef _WIN32
typedef void *(*CALLBACKFUNCPTR)(void *);
typedef void *CALLBACKFUNC;
typedef pthread_t THREADHANDLE;
typedef pthread_t THREADTYPE;
typedef pthread_attr_t THREADATTR;
#else
typedef unsigned int(__stdcall *CALLBACKFUNCPTR)(void *);
#define CALLBACKFUNC unsigned int __stdcall
typedef HANDLE THREADHANDLE;
typedef unsigned THREADTYPE;
typedef void *THREADATTR;
#endif

class Threads {

public:
  ///
  /// Public interface
  ///
  Threads();
  Threads(CALLBACKFUNCPTR, void *);
  Threads(const Threads &);

  ~Threads();

  inline const THREADTYPE GetThreadId() { return m_ThreadId; }
  inline const THREADHANDLE GetThreadHandle() { return m_ThreadHandle; }

  inline const CALLBACKFUNCPTR GetFunction() { return m_Callback; }
  inline void SetFunction(CALLBACKFUNCPTR val) { m_Callback = val; }
  inline void SetParam(void *val) { m_Param = val; }
  inline void *GetParam() { return m_Param; }
  inline const bool IsStarted() { return m_Started; }

  int SetAttribute(int);

  int Start(void);
  int Stop(void);
  void clear();
  void init();

  ///
  /// Overloading some of the operators
  /// needed for list support
  ///

  /// Overloading the == operator
  bool operator==(const Threads &other) const;

  /// Overloading the != operator
  bool operator!=(const Threads &other) const;

  /// Overloading the = operator
  Threads &operator=(const Threads &other);

  /// Overloading the > operator
  bool operator>(const Threads &other) const;

  /// Overloading the < operator
  bool operator<(const Threads &other) const;

protected:
  ///
  /// Protected interface
  ///

private:
  THREADTYPE m_ThreadId;
  THREADHANDLE m_ThreadHandle;
  CALLBACKFUNCPTR m_Callback;
  THREADATTR m_Pta;
  void *m_Param;

  bool m_Started;
};

#endif
