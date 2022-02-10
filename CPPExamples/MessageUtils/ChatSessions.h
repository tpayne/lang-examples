///
///   ChatSessions.h
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __chatsessions_h_
#define __chatsessions_h_

#include <iostream>

#include "FileTransferRequests.h"
#include "NetworkOps.h"
#include "Threads.h"

typedef bool (*CHATCALLBACKFUNCPTR)(std::string &, std::string &, int *);
typedef bool CHATCALLBACKFUNC;
typedef bool (*CHATCALLBACKSYSFUNCPTR)(std::string &, std::string &, int *, int,
                                       void *);
typedef bool CHATCALLBACKSYSFUNC;

#define MSN -1

class ChatSessions {
public:
  ///
  /// Public functions
  ///
  ChatSessions();
  ChatSessions(const std::string *);
  ChatSessions(const std::string *, CALLBACKFUNCPTR val);
  ChatSessions(const ChatSessions &val);
  virtual ~ChatSessions();

  inline bool const IsDebug() { return m_Debug; }
  inline NetworkOps *GetNetOps() { return &m_Net; }
  inline Threads *GetThread() { return &m_Thread; }

  inline const int GetSessionId() { return m_SessionId; }
  inline void SetSessionId(int val) { m_SessionId = val; }

  inline const std::string *GetError() { return &m_ErrorStr; }
  inline void SetError(const std::string *err) { m_ErrorStr = *err; }
  inline void SetError(const char *err) { m_ErrorStr = err; }
  inline const std::string *GetAlias() { return &m_WhoAlias; }
  inline void SetAlias(const std::string *val) { m_WhoAlias = *val; }
  inline void SetAlias(const char *val) { m_WhoAlias = val; }
  inline const std::string *GetWho() { return &m_Who; }
  inline void SetWho(const std::string *val) { m_Who = *val; }
  inline void SetWho(const char *val) { m_Who = val; }
  inline const CHATCALLBACKFUNCPTR GetFunction() { return m_UserCallback; }
  inline void SetFunction(CHATCALLBACKFUNCPTR val) { m_UserCallback = val; }
  inline const CHATCALLBACKSYSFUNCPTR GetSystemFunction() {
    return m_SystemCallback;
  }
  inline void SetSystemFunction(CHATCALLBACKSYSFUNCPTR val) {
    m_SystemCallback = val;
  }
  inline const std::string *GetWhoAmI() { return &m_WhoAmI; }
  inline void SetWhoAmI(const std::string *val) { m_WhoAmI = *val; }
  inline void SetWhoAmI(const char *val) { m_WhoAmI = val; }
  inline const std::string *GetWhoAmIAlias() { return &m_WhoAmIAlias; }
  inline void SetWhoAmIAlias(const std::string *val) { m_WhoAmIAlias = *val; }
  inline void SetWhoAmIAlias(const char *val) { m_WhoAmIAlias = val; }

  inline void SetDebug(bool val) { m_Debug = val; }
  inline void SetDryRun(bool val) { m_DryRun = val; }
  inline bool const IsDryRun() { return m_DryRun; }

  inline void SetReply2RemoteChat(bool val) { m_Reply2RemoteChat = val; }
  inline bool const IsReply2RemoteChat() { return m_Reply2RemoteChat; }

  inline void SetChatStarted(bool val) { m_Started = val; }
  inline bool const IsChatStarted() { return m_Started; }
  inline const bool empty() { return (!m_Net.empty() || m_Who.empty()); }
  virtual bool Disconnect(void);
  virtual bool Chat(void);
  virtual bool FileTransfer(const std::string &);
  virtual bool FileTransfer(const char *);

  int StartChat(void);

  inline FileTransferRequests *GetTransfers() { return &m_Transfers; }

  /// Remove a file transfer record
  bool RemoveTransferRequest(int);

  ///
  /// Overloading some of the operators
  /// needed for list support
  ///

  /// Overloading the == operator
  bool operator==(const ChatSessions &other) const;

  /// Overloading the != operator
  bool operator!=(const ChatSessions &other) const;

  /// Overloading the = operator
  ChatSessions &operator=(const ChatSessions &other);

  /// Overloading the > operator
  bool operator>(const ChatSessions &other) const;

  /// Overloading the < operator
  bool operator<(const ChatSessions &other) const;

protected:
  ///
  /// Protected functions
  ///
  virtual void init();
  virtual void clear();

  NetworkOps m_Net;
  Threads m_Thread;

  int m_SessionId;
  bool m_Debug;
  bool m_DryRun;
  bool m_Reply2RemoteChat;
  bool m_Started;

  std::string m_ErrorStr;
  std::string m_WhoAlias;
  std::string m_Who;
  std::string m_WhoAmI;
  std::string m_WhoAmIAlias;

  FileTransferRequests m_Transfers;

  CHATCALLBACKFUNCPTR m_UserCallback;
  CHATCALLBACKSYSFUNCPTR m_SystemCallback;

private:
  ///
  /// Private functions
  ///
};

#endif
