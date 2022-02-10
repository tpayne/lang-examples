///
/// ChatSessions.cpp
/// MessengerUtils
///
///  Created by Tim Payne on 10/09/2008.
///  Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "ChatSessions.h"
#include "MsnChatSessions.h"
#include "UtilityFuncs.h"

namespace {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   DefaultUserCallbackFunc
//   Description:
///   \brief Default user callback
//   Parameters:
///   @param std::string &in
///   @param std::string &out
///   @param int *retCode
//   Return:
///   @return CHATCALLBACKFUNC
//   Notes:
//----------------------------------------------------------------------------
///

CHATCALLBACKFUNC
DefaultUserCallbackFunc(std::string &in, std::string &out, int *retCode) {
  out = "This is a default response for the message '";
  out += in;
  out += "'";
  *retCode = 0;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   SystemCallbackFunc
//   Description:
///   \brief Default system callback
//   Parameters:
///   @param std::string &in
///   @param std::string &out
///   @param int protocol
///   @param void *ptr
//   Return:
///   @return CHATCALLBACKSYSFUNC
//   Notes:
//----------------------------------------------------------------------------
///

CHATCALLBACKSYSFUNC
SystemCallbackFunc(std::string &in, std::string &out, int *retCode,
                   int protocol, void *ptr) {
  if (protocol == MSN) {
    MsnChatSessions *chat = (MsnChatSessions *)ptr;
    if (chat == NULL)
      return false;

    // Only need the first node given...
    size_t pos1 = in.find(" ");
    std::string command = StrUtils::SubStr(in, 0, pos1);
    StrUtils::Trim(command);
    std::string option = StrUtils::SubStr(in, pos1, in.length());

    /// Process commands
    if (command == "help") {
      out = "Supported commands are: getfile, help."
            "\ngetfile - This command will get a file"
            "\nhelp    - This command will produce this message";
      *retCode = 1;
    } else if (command == "getfile") {
      if (option.empty())
        out = "getfile <fileName> - You must specify a file to process";
      else {
        if (chat->FileTransfer(option))
          out = "File transfer request logged";
        else
          out = *chat->GetError();
      }
      *retCode = 1;
    }
  }
  return true;
}
} // namespace

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

ChatSessions::ChatSessions() { init(); }

ChatSessions::ChatSessions(const std::string *hostName) {
  init();
  GetNetOps()->SetHostName(hostName);
}

ChatSessions::ChatSessions(const std::string *hostName, CALLBACKFUNCPTR val) {
  init();
  m_Thread.SetFunction(val);
  GetNetOps()->SetHostName(hostName);
}

ChatSessions::ChatSessions(const ChatSessions &val) {
  init();
  m_SessionId = val.m_SessionId;
  m_Net = val.m_Net;
  m_Thread = val.m_Thread;
  m_Debug = val.m_Debug;
  m_DryRun = val.m_DryRun;
  m_Reply2RemoteChat = val.m_Reply2RemoteChat;
  m_Started = val.m_Started;
  m_ErrorStr = val.m_ErrorStr;
  m_WhoAlias = val.m_WhoAlias;
  m_Who = val.m_Who;
  m_WhoAmI = val.m_WhoAmI;
  m_UserCallback = val.m_UserCallback;
  m_SystemCallback = val.m_SystemCallback;
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
bool ChatSessions::operator==(const ChatSessions &val) const {
  return (m_Net == val.m_Net && m_SessionId == val.m_SessionId &&
          m_Thread == val.m_Thread && m_Debug == val.m_Debug &&
          m_DryRun == val.m_DryRun &&
          m_Reply2RemoteChat == val.m_Reply2RemoteChat &&
          m_Started == val.m_Started && !m_ErrorStr.compare(val.m_ErrorStr) &&
          !m_WhoAlias.compare(val.m_WhoAlias) && !m_Who.compare(val.m_Who) &&
          !m_WhoAmI.compare(val.m_WhoAmI) &&
          !m_WhoAmIAlias.compare(val.m_WhoAmIAlias) &&
          m_SystemCallback == val.m_SystemCallback &&
          m_UserCallback == val.m_UserCallback);
}

/// Overloading the != operator
bool ChatSessions::operator!=(const ChatSessions &other) const {
  return !(*this == other);
}

/// Overloading the = operator
ChatSessions &ChatSessions::operator=(const ChatSessions &val) {
  if (this == &val)
    return *this;

  m_Net = val.m_Net;
  m_Thread = val.m_Thread;
  m_Debug = val.m_Debug;
  m_DryRun = val.m_DryRun;
  m_Reply2RemoteChat = val.m_Reply2RemoteChat;
  m_Started = val.m_Started;
  m_ErrorStr = val.m_ErrorStr;
  m_WhoAlias = val.m_WhoAlias;
  m_Who = val.m_Who;
  m_WhoAmI = val.m_WhoAmI;
  m_WhoAmIAlias = val.m_WhoAmIAlias;
  m_UserCallback = val.m_UserCallback;
  m_SystemCallback = val.m_SystemCallback;
  m_SessionId = val.m_SessionId;

  return *this;
}

/// Overloading the > operator
bool ChatSessions::operator>(const ChatSessions &other) const {
  return (m_SessionId > other.m_SessionId);
}

/// Overloading the != operator
bool ChatSessions::operator<(const ChatSessions &other) const {
  return (m_SessionId < other.m_SessionId);
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

ChatSessions::~ChatSessions() {
  (void)m_Thread.Stop();
  Disconnect();
  clear();
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
//   Notes:
//----------------------------------------------------------------------------
///

void ChatSessions::clear() {
  m_Thread.clear();
  m_Transfers.clear();
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
//   Notes:
//----------------------------------------------------------------------------
///

void ChatSessions::init() {
  m_Thread.init();
  m_DryRun = false;
  m_Debug = false;
  m_Started = false;
  m_SessionId = 0;
  SetSystemFunction(SystemCallbackFunc);
  SetFunction(DefaultUserCallbackFunc);
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Disconnect
//   Description:
///   \brief Disconnect from the messenger
//   Parameters:
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool ChatSessions::Disconnect() {
  if (GetNetOps())
    GetNetOps()->Disconnect();

  return false;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StartChat
//   Description:
///   \brief Start and detach the chat session
//   Parameters:
//   Return:
///  @return int
//   Notes:
//----------------------------------------------------------------------------
///

int ChatSessions::StartChat() {
#ifndef _WIN32
  m_Thread.SetAttribute(PTHREAD_CREATE_DETACHED);
#endif

  int rc = m_Thread.Start();
  return (rc);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Chat
//   Description:
///   \brief Start and detach the chat session
//   Parameters:
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool ChatSessions::Chat() { return false; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FileTransfer
//   Description:
///   \brief Transfer a file
//   Parameters:
///   @param std::string &fileName
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool ChatSessions::FileTransfer(const std::string &fileName) { return false; }

bool ChatSessions::FileTransfer(const char *fileName) { return false; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   RemoveTransferRequest
//   Description:
///   \brief Remove a transfer request
//   Parameters:
///   @param int requestId
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool ChatSessions::RemoveTransferRequest(int requestId) {
  FileTransferRequests::iterator it;
  FileTransfersReq request;
  bool bMatch = false;

  /// Search for the transfer requested
  for (it = GetTransfers()->begin(); (it != GetTransfers()->end() && !bMatch);
       it++) {
    FileTransfersReq tmpFileReq = static_cast<FileTransfersReq>(*it);
    if (tmpFileReq.GetCookie() == requestId) {
      request = tmpFileReq;
      bMatch = true;
      break;
    }
  }

  if (bMatch) {
    /// Blow it away
    GetTransfers()->erase(it);
    if (IsDebug())
      (void)DebugUtils::LogMessage(
          MSGINFO, "Debug: [%s,%d] Requested transfer %d removed", __FILE__,
          __LINE__, requestId);
    return true;
  }

  return false;
}
