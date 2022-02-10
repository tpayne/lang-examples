///
///   NetworkOps.h
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __networkops_h_
#define __networkops_h_

#include <errno.h>

#ifndef _WIN32
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/param.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

#define errNo errno
#define closesk close

#else
#include "config_win32_vs2005.h"
#include <io.h>
#include <winsock.h>

#ifndef EINTR
#define EINTR WSAEINTR
#endif
#ifndef EAGAIN
#define EAGAIN WSAEWOULDBLOCK
#endif
#ifndef EWOULDBLOCK
#define EWOULDBLOCK WSAEWOULDBLOCK
#endif

#define closesk closesocket
#define errNo WSAGetLastError()

#ifndef socklen_t
#define socklen_t int
#endif

#endif

#include <string>

#define DBLOCK 1024

class NetworkOps {

public:
  ///
  /// Public interface
  ///
  NetworkOps();
  NetworkOps(const std::string *, const std::string *);
  NetworkOps(const char *);
  NetworkOps(const std::string *);
  NetworkOps(const NetworkOps &);
  ~NetworkOps();

  inline const std::string *GetHostName() { return &m_HostName; }
  inline const std::string *GetService() { return &m_Service; }
  inline bool empty() { return m_HostName.empty(); }
  inline const int GetSockId() { return m_SocketId; }

  inline const std::string *GetError() { return &m_ErrorStr; }

  inline void SetHostName(const char *hostName) { m_HostName = hostName; }
  inline void SetService(const char *service) { m_Service = service; }
  inline void SetHostName(const std::string *hostName) {
    m_HostName = *hostName;
  }
  inline void SetService(const std::string *service) { m_Service = *service; }
  inline void SetSockId(const int sockId) { m_SocketId = sockId; }

  inline void SetError(const std::string *err) { m_ErrorStr = *err; }
  inline void SetError(const char *err) { m_ErrorStr = err; }

  inline void SetNonBlocking(bool val) { m_NonBlocking = val; }

  inline void SetBlock(bool val) { m_Block = val; }
  inline const bool GetBlock() { return m_Block; }

  inline bool IsConnected() { return (m_SocketId != -1); };

  inline bool const IsDebug() { return m_Debug; }
  inline void SetDebug(bool val) { m_Debug = val; }

  /// Network server routines
  bool StartServer(int);
  bool AcceptSingleConnection(void);

  /// Client access network routines
  bool Connect(void);
  bool Disconnect(void);
  bool Talk(const std::string *, std::string *, bool bforce = false);
  bool Talk(const char *, std::string *, bool bforce = false);

  /// General network routines
  int PeekMsg(std::string *);
  bool SetSocketTimeOut(int);
  bool GetBinMsg(int *, std::string &);
  bool GetBinMsg(int *, char **);
  bool SendBinMsg(void *, int, bool bforce = false);
  bool PollMsg(int);

  std::string &GetHostIPAddr(std::string &);
  std::string &GetPeerIPAddr(std::string &);
  ///
  /// Overloading some of the operators
  /// needed for list support
  ///

  /// Overloading the == operator
  bool operator==(const NetworkOps &other) const;

  /// Overloading the != operator
  bool operator!=(const NetworkOps &other) const;

  /// Overloading the = operator
  NetworkOps &operator=(const NetworkOps &other);

  /// Overloading the > operator
  bool operator>(const NetworkOps &other) const;

  /// Overloading the < operator
  bool operator<(const NetworkOps &other) const;

protected:
  void ParseHost();
  virtual void init();
  virtual void clear();

private:
  int ReadMsg(int, std::string *);
  int ReadMsg(std::string &);
  virtual int ReadMsg(char **);
  virtual int SendMsg(void *, int);

  std::string m_HostName;
  std::string m_Service;

  std::string m_ErrorStr;
  bool m_NonBlocking;
  bool m_Block;
  int m_SocketId;
  bool m_Debug;

#ifdef _WIN32
  bool m_Started;
#endif
};

#endif