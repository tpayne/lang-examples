///
///   MsnChatSessions.h
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __msnchatsessions_h_
#define __msnchatsessions_h_

#include "ChatSessions.h"
#include "MsnConstants.h"
#include "MsnMsg.h"

class MsnChatSessions : public ChatSessions {

public:
  ///
  /// Public functions
  ///
  MsnChatSessions();
  MsnChatSessions(const std::string *, int);
  MsnChatSessions(const MsnChatSessions &);
  ~MsnChatSessions();

  bool Disconnect(void);
  bool Chat(void);
  bool FileTransfer(const std::string &);
  bool FileTransfer(const char *);

  inline const int GetProtocol() { return m_Protocol; }
  inline void SetProtocol(int val) { m_Protocol = val; }

  ///
  /// Overloading some of the operators
  /// needed for list support
  ///

  /// Overloading the = operator
  MsnChatSessions &operator=(const MsnChatSessions &other);

protected:
  ///
  /// Protected functions
  ///
  void init();
  void clear();

private:
  ///
  /// Private functions
  ///
  const std::string *GetNTriId();
  void FormatChatMsg(const std::string &, std::string &);
  void FormatChatMsg(const char *, std::string &);
  void FormatChatMsg(MSNChatMsg &, std::string &);
  int noMsgs2Process(std::string *, std::string *);
  int DoAChat(std::string *);
  bool ProcessMsg(std::string &);
  bool FileTransferMsnp8(const std::string &);
  bool ProcessFileRequest(MSNChatMsg &);
  ///
  ///
  int m_TriId;
  std::string m_TriIdStr;
  int m_Protocol;
};

#endif