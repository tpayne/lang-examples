///
///   MessengerApps.h
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __messengerapps_h__
#define __messengerapps_h__

#include "ChatSessions.h"
#include "NetworkOpsSSL.h"

#include <list>
#include <map>
#include <vector>

typedef std::vector<ChatSessions *> Chats;
typedef std::map<std::string, std::string> SymbolMap;
typedef std::pair<std::string, std::string> Symbols;

class MessengerApps {
public:
  ///
  /// Public functions
  ///
  MessengerApps();
  MessengerApps(const int, const char **);
  ~MessengerApps();

  ///
  /// Virtual functions
  ///
  virtual void Usage(const int, const char **);
  virtual bool Connect();
  virtual bool Disconnect();
  virtual void AddContact(const std::string *);
  virtual void AddGroup(const std::string *);
  virtual void RemoveContact(const std::string *);
  virtual bool StartChat(const std::string *);
  virtual bool StartChat(const char *);
  virtual bool ResetAlias(const std::string *);
  virtual bool ResetAlias(const char *);

  /// Inline functions
  inline bool const IsDebug() { return m_Debug; }
  inline bool const IsMessagesAllowed() { return m_AcceptMsg; }
  inline void SetMessagesAllowed(bool val) { m_AcceptMsg = val; }
  inline bool const IsOk() { return m_Ok; };
  inline std::list<std::string> *GetContacts() { return &m_Users; }
  inline std::list<std::string> *GetGroups() { return &m_Groups; }
  inline Chats *GetChats() { return &m_Chats; }
  inline int const GetConnectAttempts() { return m_iConnectAttempts; }
  inline void SetConnectAttempts(int val) { m_iConnectAttempts = val; }
  inline const CHATCALLBACKFUNCPTR GetFunction() { return m_Callback; }
  inline void SetFunction(CHATCALLBACKFUNCPTR val) { m_Callback = val; }

  inline void SetConfigFile(const char *val) { m_configFile = val; }
  inline void SetConfigFile(std::string &val) { m_configFile = val; }

  inline std::string *const GetConfigFile() { return &m_configFile; }
  const char *GetSymbol(std::string &);
  const char *GetSymbol(const char *);
  bool ReadConfigFile();

protected:
  ///
  /// Protected functions
  ///
  virtual bool ParseArgs(const int, const char **);
  virtual void init();
  virtual void clear();

  inline NetworkOps *GetNetOps() { return &m_Net; }
  inline NetworkOpsSSL *GetNetOpsSSL() { return &m_NetSSL; }

  inline bool const IsDryRun() { return m_DryRun; }

  inline void SetDebug(bool val) { m_Debug = val; }
  inline void SetDryRun(bool val) { m_DryRun = val; }

  bool ChatEstablished(const std::string *);

  ///
  /// Variables
  ///
  bool m_Ok;
  bool m_Debug;
  bool m_DryRun;
  bool m_AcceptMsg;

  int m_iConnectAttempts;

  NetworkOps m_Net;
  NetworkOpsSSL m_NetSSL;
  std::list<std::string> m_Users;
  std::list<std::string> m_Groups;
  std::string m_configFile;
  SymbolMap m_Symbols;
  Chats m_Chats;
  CHATCALLBACKFUNCPTR m_Callback;

private:
};

#endif
