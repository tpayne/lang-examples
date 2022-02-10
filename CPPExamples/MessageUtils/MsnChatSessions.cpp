///
///  MsnChatSessions.cpp
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifdef _WIN32
#include "config_win32_vs2005.h"
#include <io.h>
#endif
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>

#include <sys/stat.h>

#include "FileTransferRequests.h"
#include "Msn.h"
#include "MsnChatSessions.h"
#include "Threads.h"
#include "UtilityFuncs.h"

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///  Constructors
//   Description:
///  \brief Constructor routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

MsnChatSessions::MsnChatSessions() { init(); }

MsnChatSessions::MsnChatSessions(const std::string *hostName, int protocol) {
  init();
  GetNetOps()->SetHostName(hostName);
  SetProtocol(protocol);
}

MsnChatSessions::MsnChatSessions(const MsnChatSessions &val) {
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
  m_WhoAmIAlias = val.m_WhoAmIAlias;

  m_UserCallback = val.m_UserCallback;
  m_SystemCallback = val.m_SystemCallback;

  m_TriId = val.m_TriId;
  m_TriIdStr = val.m_TriIdStr;
  m_Protocol = val.m_Protocol;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///  Overrides
//   Description:
///  \brief Operator overrides routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

// Overloading the = operator
MsnChatSessions &MsnChatSessions::operator=(const MsnChatSessions &val) {
  if (this == &val)
    return *this;

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
  m_WhoAmIAlias = val.m_WhoAmIAlias;

  m_UserCallback = val.m_UserCallback;
  m_SystemCallback = val.m_SystemCallback;

  m_TriId = val.m_TriId;
  m_TriIdStr = val.m_TriIdStr;
  m_Protocol = val.m_Protocol;

  return *this;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///  Destructors
//   Description:
///  \brief Destructors routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

MsnChatSessions::~MsnChatSessions() {
  Disconnect();
  clear();
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///  clear
//   Description:
///   \brief clear the class
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MsnChatSessions::clear() {
  ChatSessions::clear();
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///  init
//   Description:
///  \brief init the class
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MsnChatSessions::init() {
  ChatSessions::init();
  m_TriId = 1;
  m_Protocol = 0;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///    Disconnect
//   Description:
///   \brief Disconnect from the messenger
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool MsnChatSessions::Disconnect() {
  if (IsChatStarted()) {
    ///   Setup the message
    std::string message;

    message = "BYE\r\n";

    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, message.c_str());

    if (!IsDryRun())
      (void)GetNetOps()->Talk(&message, NULL, true);
  }

  GetNetOps()->Disconnect();

  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FormatChatMsg
//   Description:
///   \brief Format a message for a chat session
//   Parameters:
///   @param const char *ptrMessage
///   @param std::string &reply
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MsnChatSessions::FormatChatMsg(const char *ptrMessage,
                                    std::string &reply) {
  const std::string message = ptrMessage;

  return (FormatChatMsg(message, reply));
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FormatChatMsg
//   Description:
///   \brief Format a message for a chat session
//   Parameters:
///   @param const std::string &message
///   @param std::string &reply
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MsnChatSessions::FormatChatMsg(const std::string &message,
                                    std::string &reply) {
  MSNChatMsg msg(
      "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n"
      "X-MMS-IM-Format: FN=Arial; EF=I; CO=0; CS=0; PF=22\r\n\r\n");
  msg.SetMsg(message);
  std::string istr = msg.ConstructTxtMsg();

  reply = "MSG ";
  reply += *GetNTriId();
  reply += " N ";
  StrUtils::i2str(msg.CalcPayLoad(), istr);
  reply += istr;
  reply += msg.ConstructTxtMsg();
  reply += message;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, reply.c_str());

  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FormatChatMsg
//   Description:
///   \brief Format a message for a chat session
//   Parameters:
///   @param MSNChatMsg &message
///   @param std::string &reply
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MsnChatSessions::FormatChatMsg(MSNChatMsg &message, std::string &reply) {
  std::string messFormat;
  messFormat = "\r\n";
  messFormat += *message.GetMime();
  messFormat += "\r\n";
  messFormat += *message.GetContentType();
  messFormat += "\r\n";
  messFormat += *message.GetIMFormat();
  messFormat += "\r\n\r\n";

  int payloadLen = message.size() + (messFormat.size() - 2);

  reply = "MSG ";
  reply += *GetNTriId();
  reply += " N ";
  std::string istr;
  StrUtils::i2str(payloadLen, istr);
  reply += istr;
  reply += messFormat;
  reply += *message.GetMsg();
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   noMsgs2Process
//   Description:
///   Calculate the number of MSG replies I need to deal with
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

int MsnChatSessions::noMsgs2Process(std::string *ptrMessage,
                                    std::string *line2Chk) {
  std::string message = *ptrMessage;
  int ii = 0;
  const char *tmpStr = 0;

  while (!message.empty()) {
    std::string line;
    MsnUtils::MSNParseChatLine(message, line);
    tmpStr = strstr(line.c_str(), line2Chk->c_str());
    if (tmpStr)
      ii++;
    tmpStr = NULL;
  }
  return ii;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetNTriId
//   Description:
///   Get a TriId
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

const std::string *MsnChatSessions::GetNTriId() {
  char str[50 + 1];
  m_TriId++;
#ifndef _WIN32
  (void)sprintf(str, "%d", m_TriId);
#else
  (void)sprintf_s(str, 50, "%d", m_TriId);
#endif
  m_TriIdStr = str;
  return &m_TriIdStr;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessMsg
//   Description:
///   \brief Process a MSG
//   Parameters:
///	  @param std::string &ptrMessage
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool MsnChatSessions::ProcessMsg(std::string &ptrMessage) {
  std::string message = ptrMessage;
  bool bCode = false;
  std::string line;
  bool bMess = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] message='%s'",
                                 __FILE__, __LINE__, message.c_str());

  MsnUtils::MSNParseChatLine(message, line, true);
  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s %s", __FILE__,
                                 __LINE__, message.c_str(), line.c_str());

  int payLoad = MsnUtils::MSNGetPayload(line);
  line = message;
  MSNChatMsg ChatLine(line, payLoad);
  message = StrUtils::SubStr(message, payLoad, message.length());

  line = "";

  ///   Do the message callback
  if (ChatLine.IsChat() && ChatLine.GetMsg()->empty()) {
    ///
    /// Chat line - ignore
    ///
    if (IsDebug())
      (void)DebugUtils::LogMessage(
          MSGINFO, "Debug: [%s,%d] ChatLog line detected", __FILE__, __LINE__);
    bMess = false;
  } else if (ChatLine.IsInvite()) {
    bCode = false;

    ///
    /// This is an invite of somekind that I need to process
    ///
    if (ChatLine.GetMsg()->find("Invitation-Command: ACCEPT") !=
        std::string::npos) {
      /// Someone accepted a file send from me
      bCode = ProcessFileRequest(ChatLine);
      if (bCode) {
        int cookie = MsnUtils::MSNGetCookieId(ChatLine.GetMsg());
        if (cookie > 0)
          bCode = RemoveTransferRequest(cookie);
      }
      /// The MSN session is now no longer usable.
      /// I need to kill myself - any new messages will be handled by a new
      /// connection
      Disconnect();
      clear();
      GetThread()->Stop();
    } else if (ChatLine.GetMsg()->find("Invitation-Command: CANCEL") !=
               std::string::npos) {
      /// Someone rejected a file send from me
      int cookie = MsnUtils::MSNGetCookieId(ChatLine.GetMsg());
      if (cookie > 0)
        bCode = RemoveTransferRequest(cookie);
      if (bCode)
        line = "File transfer request removed successfully";
      else
        line = "File transfer request removal failed";
    }
  } else if (ChatLine.IsText()) {
    ///
    /// This is a simple text message that I need to process
    ///
    int retCode = 0;
    bool ret = false;
    CHATCALLBACKFUNCPTR cb = GetFunction();
    CHATCALLBACKSYSFUNCPTR sysCb = GetSystemFunction();
    line = "";
    std::string mess = *ChatLine.GetMsg();
    ret = (*sysCb)(mess, line, &retCode, MSN, (void *)this);
    if (retCode == 0)
      ret = (*cb)(mess, line, &retCode);
    if (!ret)
      bMess = false;
  }

  if (bMess && !line.empty()) {
    std::string response;
    std::string myReply(CLIENTAPP);
    myReply += " ";
    myReply += CLIENTAPPVRS;
    myReply += ": ";

    StrUtils::Trim(line);
    StrUtils::p2str(GetThread()->GetThreadId(), myReply);

    myReply += " ";
    myReply += line;

    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, line.c_str());

    FormatChatMsg(myReply, response);

    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, response.c_str());

    if (!IsDryRun())
      bCode = GetNetOps()->Talk(&response, NULL);
    else
      bCode = true;

    if (!bCode) {
      SetError(GetNetOps()->GetError());
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, GetError()->c_str());
      ptrMessage = message;
      return bCode;
    }
  }

  ptrMessage = message;
  return bCode;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   DoAChat
//   Description:
///   Do a chat line
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

int MsnChatSessions::DoAChat(std::string *ptrMessage) {
  std::string message = *ptrMessage;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  int bRet = 0;

  std::string line;
  ///
  /// Process the messages I have...
  ///
  while (!message.empty()) {
    MsnUtils::MSNParseChatLine(message, line, true);
    MSNChatMsg msg(line);
    std::string msgcode;
    msg.GetMsgCode(msgcode);

    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] msgcode = %s '%s'",
                                   __FILE__, __LINE__, msgcode.c_str(),
                                   message.c_str());

    if (msgcode == "BYE") {
      ///
      /// Process BYE
      ///
      /// Did you mean me?
      std::string bye = "BYE ";
      /// Woops, looks like MSN killed me
      /// time to commit suicide
      if (IsDebug())
        (void)DebugUtils::LogMessage(
            MSGINFO, "Debug: [%s,%d] MSN killed me - Bye!", __FILE__, __LINE__);
      Disconnect();
      clear();

      bRet = 2;
      GetThread()->Stop();
    } else if (msgcode == "MSG") {
      ///
      /// Process MSG codes
      ///
      ProcessMsg(message);
    } else
      MsnUtils::MSNParseChatLine(message, line);
  }

  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Chat
//   Description:
///   Start and detach the chat session
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool MsnChatSessions::Chat() {
  int read = 0;
  bool bRet = true;
  std::string message;
  std::string responses;

  /// Signal that a chat has started
  SetChatStarted(true);

  GetNetOps()->SetBlock(false);

  /// Send an initial hello message...
  if (!IsReply2RemoteChat()) {
    std::string myReply(CLIENTAPP);
    myReply += " ";
    myReply += CLIENTAPPVRS;
    myReply += ": ";
    myReply += "Hello";

    FormatChatMsg(myReply, message);

    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, message.c_str());

    if (!IsDryRun())
      (void)GetNetOps()->Talk(&message, NULL);
  }

  message = "";

  while (bRet) {
#ifdef _WIN32
    if (!TestTagFile()) {
      bRet = false;
      break;
    }
#endif
    if (GetNetOps()->GetBinMsg(&read, message)) {
      if (read == 0 || message.empty())
        continue;

      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, message.c_str());

      read = DoAChat(&message);

      if (read == 2)
        bRet = false;
    }
  }

  /// Trial message
  message = "OUT\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return 0;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  return 0;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FileTransfer
//   Description:
///   Transfer a file
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool MsnChatSessions::FileTransfer(const char *fileName) {
  std::string message = fileName;
  StrUtils::Trim(message);
  return (FileTransfer(message));
}

bool MsnChatSessions::FileTransfer(const std::string &fileName) {
  if (GetProtocol() == MSNP8) {
    std::string message = fileName;
    StrUtils::Trim(message);
    return (FileTransferMsnp8(message));
  }
  return false;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FileTransferMsnp8
//   Description:
///   \brief Transfer a file via MSNP8 protocol. This assumes I'm sending the
///   file!
//   Parameters:
///   @param const std::string &fileName
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool MsnChatSessions::FileTransferMsnp8(const std::string &fileName) {
  bool bRet = false;

  /// Check I can access and read the proposed file
  struct stat f2transfer = {0};

  if ((access(fileName.c_str(), R_OK) < 0) ||
      (stat(fileName.c_str(), &f2transfer) < 0)) {
    std::string errMsg("- Unable to access the file specified - '");
    errMsg += fileName.c_str();
    errMsg += "' - to transfer to remote user - ";
    char error[1024 + 1];
#ifndef _WIN32
    if (strerror_r(errNo, error, sizeof(error)) == 0)
      errMsg += error;
#else
    if (strerror_s(error, sizeof(error), errNo) == 0)
      errMsg += error;
#endif
    SetError(&errMsg);
    return bRet;
  }

  /// Construct the initial transfer request message
  std::string message;
  std::string payLoad;
  std::string responses;

  MSNChatMsg MsnLoad("MIME-Version: 1.0\r\n"
                     "Content-Type: text/x-msmsgsinvite; charset=UTF-8\r\n"
                     "\r\n");

  payLoad =
      "Application-Name: File Transfer\r\n"
      ///
      /// It looks like the application GUI is fixed with different applications
      /// having
      /// different GUIDs, e.g.
      /// - Application-GUID {F1B1920C-6A3C-4ce7-B18C-AFAB305FD03D} for
      /// Netmeeting
      /// - Application-GUID {56b994a7-380f-410b-9985-c809d78c1bdc} for remote
      /// assistence
      /// - Application-GUID {02D3C01F-BF30-4825-A83A-DE7AF41648AA} for
      /// teleconferencing
      /// - Application-GUID {2A23868E-B45F-401d-B8B0-1E16B774A5B7} for webcam
      /// - Application-GUID {5D3E02AB-6190-11d3-BBBB-00C04F795683} for file
      /// transfer
      /// ...and so on...
      ///
      "Application-GUID: {5D3E02AB-6190-11d3-BBBB-00C04F795683}\r\n"
      "Invitation-Command: INVITE\r\n";

  /// Generate a "random" number
  srand(time(NULL));
  int cookieInvite =
      (rand() % 20000 + 120); /// random number between 120 and 20120
  std::string istr;

  payLoad += "Invitation-Cookie: ";
  StrUtils::i2str(cookieInvite, istr);
  payLoad += istr;
  payLoad += "\r\nApplication-File: ";
  istr = fileName;
  payLoad += FileUtils::GetFileName(istr);
  payLoad += "\r\nApplication-FileSize: ";
  StrUtils::i2str(f2transfer.st_size, istr);
  payLoad += istr;
  payLoad += "\r\n\r\n";

  MsnLoad.SetMsg(payLoad);

  payLoad = MsnLoad.ConstructTxtMsg();

  /// Construct the message
  message = "MSG ";
  message += *GetNTriId();
  message += " N ";
  StrUtils::i2str(MsnLoad.CalcPayLoad(), istr);
  message += istr;
  message += MsnLoad.ConstructTxtMsg();
  message += *MsnLoad.GetMsg();

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, NULL);
  else
    bRet = true;

  /// Register the transfer request
  FileTransfersReq r1(fileName, *GetWho(), cookieInvite, f2transfer.st_size);
  GetTransfers()->push_back(r1);

  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessFileRequest
//   Description:
///   \brief Respond to a file transfer request
//   Parameters:
///   @param MSNChatMsg &chatLine
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool MsnChatSessions::ProcessFileRequest(MSNChatMsg &ChatLine) {
  bool accepted = false;
  bool bRet = false;
  bool bMatch = false;

  /// Construct the initial transfer request message
  std::string message;
  std::string payLoad;
  std::string responses;
  std::string istr;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO,
                                 "Debug: [%s,%d] Processing a file request",
                                 __FILE__, __LINE__);

  int cookieInvite = MsnUtils::MSNGetCookieId(ChatLine.GetMsg());
  if (cookieInvite < 0) {
    SetError(" - Unable to calculate the cookie identifier for this transfer "
             "session ");
    return false;
  }

  /// Was the request accepted?
  if (ChatLine.GetMsg()->find("Invitation-Command: ACCEPT") !=
      std::string::npos)
    accepted = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(
        MSGINFO, "Debug: [%s,%d] A file request will be %s", __FILE__, __LINE__,
        (accepted) ? "processed" : "removed");

  FileTransferRequests::iterator it;
  FileTransfersReq request;

  for (it = GetTransfers()->begin(); (it != GetTransfers()->end() && !bMatch);
       it++) {
    FileTransfersReq tmpFileReq = static_cast<FileTransfersReq>(*it);
    if (tmpFileReq.GetCookie() == cookieInvite) {
      request = tmpFileReq;
      bMatch = true;
      break;
    }
  }

  if (!bMatch) {
    SetError(" - Unable to find a request matching the cookie invite string");
    return false;
  }

  /// Propose a machine and port to use for the transfer
  MSNChatMsg MsnLoad("MIME-Version: 1.0\r\n"
                     "Content-Type: text/x-msmsgsinvite; charset=UTF-8\r\n");

  payLoad = "Invitation-Command: ACCEPT\r\n"
            "Invitation-Cookie: ";
  StrUtils::i2str(cookieInvite, istr);
  payLoad += istr;
  payLoad += "\r\n";
  payLoad += "IP-Address: ";
  std::string hostName;
  istr = NetUtils::GetInetAddrLocalIp(istr);
  if (istr.empty())
    istr = GetNetOps()->GetHostIPAddr(istr);
  payLoad += istr;
  payLoad += "\r\n";
  payLoad += "Port: 6891";
  payLoad += "\r\nAuthCookie: ";
  srand(time(NULL));
  int cookieAuth =
      (rand() % 20000 + 120); /// random number between 120 and 20120

  StrUtils::i2str(cookieAuth, istr);
  payLoad += istr;
  payLoad +=
      "\r\nLaunch-Application: FALSE\r\nRequest-Data: IP-Address:\r\n\r\n";

  MsnLoad.SetMsg(payLoad);

  payLoad = MsnLoad.ConstructTxtMsg();

  /// Construct the message
  message = "MSG ";
  message += *GetNTriId();
  message += " N ";
  StrUtils::i2str(MsnLoad.CalcPayLoad(), istr);
  message += istr;
  message += MsnLoad.ConstructTxtMsg();
  message += *MsnLoad.GetMsg();

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, NULL);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(
        MSGINFO, "Debug: [%s,%d] Starting up a listener", __FILE__, __LINE__);

  Disconnect();

  /// Start a network server
  NetworkOps fileServer;
  fileServer.SetService("6891");
  fileServer.SetDebug(IsDebug());

  if (!fileServer.StartServer(2)) {
    SetError(fileServer.GetError());
    fileServer.Disconnect();
    return false;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(
        MSGINFO, "Debug: [%s,%d] Waiting for a connection", __FILE__, __LINE__);

  if (!fileServer.AcceptSingleConnection()) {
    SetError(fileServer.GetError());
    fileServer.Disconnect();
    return false;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(
        MSGINFO, "Debug: [%s,%d] Waiting for a message", __FILE__, __LINE__);

  message = "";
  /// Wait for a message from the client
  if (!IsDryRun())
    bRet = fileServer.Talk(&message, &responses);
  else
    bRet = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  if (responses.find("VER MSNFTP") == std::string::npos || !bRet) {
    /// Message was invalid - goodbye
    if (!bRet)
      SetError(" - The client sent an invalid request and was disconnected");
    else
      SetError(fileServer.GetError());
    fileServer.Disconnect();

    return false;
  }

  message = "VER MSNFTP\r\n";
  /// Wait for a message from the client
  if (!IsDryRun())
    bRet = fileServer.Talk(&message, &responses);
  else
    bRet = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  /// Get the user id and auth cookie...
  message = StrUtils::SubStr(responses, 0, responses.find(" "));
  StrUtils::Trim(message);

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (message.find("USR") == std::string::npos || !bRet) {
    /// Message was invalid - goodbye
    if (!bRet)
      SetError(" - The client sent an invalid request and was disconnected");
    else
      SetError(fileServer.GetError());
    fileServer.Disconnect();

    return false;
  }

  /// Get the user id and auth cookie...
  /// Skip USR
  responses =
      StrUtils::SubStr(responses, responses.find(" "), responses.length());
  StrUtils::Trim(responses);
  /// Get username
  message = StrUtils::SubStr(responses, 0, responses.find(" "));
  responses =
      StrUtils::SubStr(responses, responses.find(" "), responses.length());
  StrUtils::Trim(message);
  StrUtils::Trim(responses);

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] user = %s, cookie=%s",
                                 __FILE__, __LINE__, message.c_str(),
                                 responses.c_str());

  if (message.compare(*GetWho())) {
    /// Message was invalid - goodbye
    SetError(" - The client sent an invalid request and was disconnected");
    fileServer.Disconnect();
    return false;
  }

  int cookie = (int)strtol(responses.c_str(), (char **)NULL, 10);

  if (cookieAuth != cookie) {
    /// Message was invalid - goodbye
    SetError(" - The client sent an invalid request and was disconnected");
    fileServer.Disconnect();
    return false;
  }

  message = "FIL ";
  StrUtils::i2str(request.GetFileSz(), istr);
  message += istr;
  message += "\r\n";

  /// I want to start sending the file - okay?
  if (!IsDryRun())
    bRet = fileServer.Talk(&message, &responses);
  else
    bRet = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  if (responses.find("TFR") == std::string::npos || !bRet) {
    /// Message was invalid - goodbye
    if (!bRet)
      SetError(" - The client sent an invalid request and was disconnected");
    else
      SetError(fileServer.GetError());
    fileServer.Disconnect();

    return false;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(
        MSGINFO, "Debug: [%s,%d] Opening '%s' for transfer", __FILE__, __LINE__,
        request.GetFile()->c_str());

  /// Start to transfer the file
  int fileNo = open(request.GetFile()->c_str(),
                    O_BINARY | O_RDONLY); /// Open file in readonly, binary mode

  if (fileNo < 0) {
    // An error occurred
    std::string errMsg("- An error occurred opening the file for transfer ");
    char error[1024 + 1];
#ifndef _WIN32
    if (strerror_r(errNo, error, sizeof(error)) == 0)
      errMsg += error;
#else
    if (strerror_s(error, sizeof(error), errNo) == 0)
      errMsg += error;
#endif
    SetError(&errMsg);
    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, errMsg.c_str());
    fileServer.Disconnect();
    return false;
  }

  int filesz = request.GetFileSz();
  int fileTransferred = 0;
  char *toTransfer = (char *)calloc(
      (MSNFTPPACKSIZ + 3), sizeof(char)); /// Allocate memory for the transfer

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Transferring %d",
                                 __FILE__, __LINE__, filesz);

  while (fileTransferred < filesz) /// Repeat while something to do
  {
    int i = 0;
    int packetsz = (filesz - fileTransferred);
    if (packetsz > MSNFTPPACKSIZ)
      packetsz = MSNFTPPACKSIZ;

    /// Packet size has a header of 3 bytes
    toTransfer[i++] = (char)0x00; /// First byte = 0
    toTransfer[i++] =
        (char)(packetsz & 0x00FF); /// Second byte = (packet_size MOD 255)
    toTransfer[i++] = (char)((packetsz & 0xff00) >>
                             8); /// Third byte = (packet_size MOD 65280)

    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO,
                                   "Debug: [%s,%d] Transferring %d of %d",
                                   __FILE__, __LINE__, fileTransferred, filesz);

    if (read(fileNo, &toTransfer[i], packetsz) < 0) {
      free(toTransfer);
      SetError(" - An error occurred reading the file for transfer");
      fileServer.Disconnect();
      return false;
    }

    /// Send the message -
    if (!fileServer.SendBinMsg(&toTransfer[0], packetsz + MSNFTPPACKHDR)) {
      free(toTransfer);
      SetError(" - An error occurred transferring the file");
      fileServer.Disconnect();
      return false;
    }

    fileTransferred += packetsz;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Transfer done",
                                 __FILE__, __LINE__);

  (void)close(fileNo);
  free(toTransfer);

  /// I sent the file - what happened to it?
  message = "";
  if (!IsDryRun())
    bRet = fileServer.Talk(&message, &responses);
  else
    bRet = true;
  fileServer.Disconnect();

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  if (responses.find(MSNFTPOK) == std::string::npos || !bRet) {
    /// Transfer failed
    if (!bRet)
      SetError(" - The transfer failed for some reason");
    else
      SetError(fileServer.GetError());

    return false;
  }

  /// Transfer worked - all is cool
  return true;
}
