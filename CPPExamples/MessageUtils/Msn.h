///
///   Msn.h
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __msn_h__
#define __msn_h__

#include "MessengerApps.h"
#include "MsnConstants.h"
#include <cstring>

class Msn : public MessengerApps {

public:
  ///
  /// Public functions
  ///
  Msn();
  Msn(const int, const char **);
  ~Msn();

  inline const std::string *GetHostName() { return &m_HostName; }
  inline const std::string *GetService() { return &m_Service; }
  inline const std::string *GetUser() { return &m_User; }
  inline const std::string *GetPasswd() { return &m_Passwd; }
  inline const std::string *GetError() { return &m_ErrorStr; }
  inline const std::string *GetAlias() { return &m_Alias; };
  inline Threads *GetThread() { return &m_Thread; }

  inline void SetHostName(std::string &hostName) { m_HostName = hostName; }
  inline void SetService(std::string &service) { m_Service = service; }
  inline void SetHostName(const char *hostName) { m_HostName = hostName; }
  inline void SetService(const char *service) { m_Service = service; }
  inline void SetUserName(const char *user) { m_User = user; }
  inline void SetPasswd(const char *passwd) { m_Passwd = passwd; }
  inline void SetUserName(std::string &user) { m_User = user; }
  inline void SetPasswd(std::string &passwd) { m_Passwd = passwd; }
  inline void SetAlias(const char *val) { m_Alias = val; }
  inline void SetAlias(const std::string *val) { m_Alias = *val; }

  inline const bool IsConnected() { return m_bConnect; }
  const std::string *GetNTriId();

  inline const std::string *GetCTriId() { return &m_TriIdStr; }

  bool Connect();
  bool Disconnect();
  void Usage(const int, const char **);
  bool SetMSNStatus(const char *);
  bool SetMSNStatus(const char *, std::string *);
  bool MSNSynch(void);
  bool MSNPing(void);
  bool MSNPing(std::string *);
  bool MD5Calc(const std::string *, std::string *);
  bool MSNChallengeResponse(const std::string *);
  bool ProcessCalls(void);
  bool StartChat(const std::string *);
  bool StartChat(const char *);
  bool SetSwitchboardStatus(bool);
  bool ResetAlias(const std::string *);
  bool ResetAlias(const char *);
  bool RestartMonitor(void);

  inline const int GetThreadState() { return m_ThreadState; }
  inline void SetThreadState(int val) { m_ThreadState = val; }

protected:
  ///
  /// Protected functions
  ///
  void clear();
  void init();

  bool ParseArgs(const int, const char **);
  inline void SetError(const std::string *err) { m_ErrorStr = *err; }
  inline void SetError(const char *err) { m_ErrorStr = err; }
  inline int const GetProtocol() { return m_Protocol; }

private:
  bool MSNP8_Login(void);
  inline void SetProtcol(int val) { m_Protocol = val; }
  void ParseGrpAndUsrs(const std::string *);
  bool MSNChat(const std::string *);

  int m_Protocol;
  int m_TriId;
  int m_ThreadState;

  std::string m_TriIdStr;
  std::string m_HostName;
  std::string m_Service;
  std::string m_User;
  std::string m_Passwd;
  std::string m_ErrorStr;
  std::string m_Alias;
  bool m_bConnect;
  Threads m_Thread;
};

#endif
