///
///   Yahoo.cpp
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include <iostream>
#ifndef _WIN32
#include <sys/utsname.h>
#include <thread>
#endif
#include <locale.h>

#include "UtilityFuncs.h"
#include "Yahoo.h"
#include "YahooConstants.h"
#include "YahooMsg.h"

namespace {
static CALLBACKFUNC ProcessCallback(void *ptrClass) {
  Yahoo *yahoo = (Yahoo *)ptrClass;
  if (yahoo) {
    if (yahoo->IsDebug())
      std::cout << "Thread id: " << yahoo->GetThread()->GetThreadId()
                << std::endl;
    if (yahoo->ProcessCalls()) {
      yahoo->SetThreadState(1);
    } else
      yahoo->SetThreadState(-1);

    if (yahoo->IsDebug())
      (void)DebugUtils::LogMessage(
          MSGINFO, "Debug: [%s,%d] Process thread died unnaturally with %d",
          __FILE__, __LINE__, yahoo->GetThreadState());
  }
  return 0;
}
} // namespace

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Constructors
//   Description:
///   Constructor routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

Yahoo::Yahoo() { init(); }

Yahoo::Yahoo(const int argc, const char **argv) {
  init();
  m_Ok = ParseArgs(argc, argv);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Destructors
//   Description:
///   Destructors routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

Yahoo::~Yahoo() {
  clear();
  init();
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   clear
//   Description:
///   clear the class
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void Yahoo::clear() {
  (void)Disconnect();
#ifndef _WIN32
  m_Thread.Stop();
#endif
  m_Thread.clear();
  MessengerApps::clear();
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   init
//   Description:
///   init the class
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void Yahoo::init() {
  MessengerApps::init();
  m_Thread.init();
  m_bConnect = false;
  m_Protocol = 0;
  m_ThreadState = 0;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ParseArgs
//   Description:
///   Parse arguments and populate the class
//   Parameters:
///   const int argc
///   const char **argv
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::ParseArgs(const int argc, const char **argv) {
  //
  // Parse options...
  //
  int i = 1;
  while (i < argc) {
    switch ((char)(*(argv[i] + 1))) {
      // Config file
    case 'c':
      if (!strcasecmp(argv[i], "-config-file")) {
        if ((i + 1) == argc)
          return false;
        SetConfigFile(argv[++i]);
      }
      i++;
      break;

    case 'm':
      if (!strcasecmp(argv[i], "-yahoohost")) {
        if ((i + 1) == argc)
          return false;
        SetHostName(argv[++i]);
      }
      i++;
      break;

    case 's':
      if (!strcasecmp(argv[i], "-service")) {
        if ((i + 1) == argc)
          return false;
        SetService(argv[++i]);
      }
      i++;
      break;

      // Password...
    case 'p':
      if (!strcasecmp(argv[i], "-password")) {
        if ((i + 1) == argc)
          return false;
        SetPasswd(argv[++i]);
      }
      i++;
      break;
      // User...
    case 'u':
      if (!strcasecmp(argv[i], "-user")) {
        if ((i + 1) == argc)
          return false;
        SetUserName(argv[++i]);
      }
      i++;
      break;
      // Options...
    case '-':
      if (!strcasecmp(argv[i], "--debug"))
        SetDebug(true);
      else if (!strcasecmp(argv[i], "--dryrun"))
        SetDryRun(true);
      i++;
      break;
    default:
      i++;
      break;
    }
  }

  if (!GetConfigFile()->empty()) {
    if (ReadConfigFile()) {
      if (!IsDebug())
        SetDebug(StrUtils::str2bool(GetSymbol("DEBUG")));
      if (!IsDryRun())
        SetDryRun(StrUtils::str2bool(GetSymbol("DRYRUN")));
      if (GetUser()->empty()) {
        if (GetSymbol("YAHOO_USER")) {
          std::string yahooUser = GetSymbol("YAHOO_USER");
          std::string userName =
              StrUtils::SubStr(yahooUser, 0, yahooUser.find(":"));
          std::string passWd = StrUtils::SubStr(
              yahooUser, (yahooUser.find(":")) + 1, yahooUser.length());
          StrUtils::Trim(userName);
          StrUtils::Trim(passWd);
          SetUserName(userName);
          SetPasswd(passWd);
        }
      }
      if (GetHostName()->empty()) {
        if (GetSymbol("YAHOO_HOST")) {
          std::string yahooHost = GetSymbol("YAHOO_HOST");
          StrUtils::Trim(yahooHost);
          SetHostName(yahooHost);
        }
      }
    } else
      return false;
  }
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Usage
//   Description:
///   Usage
//   Parameters:
///   const int argc
///   const char **argv
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void Yahoo::Usage(const int argc, const char **argv) {
  std::cout
      << std::endl
      << "Usage: <hostName> <serviceName> -user <userId> -password <passwd>"
      << std::endl;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Connect
//   Description:
///   Connect to the messenger
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::Connect() {
  bool bRet = false;

  for (int i = 0; i <= GetConnectAttempts(); i++) {
    (void)GetNetOps()->Disconnect();
    (void)GetNetOps()->SetHostName(GetHostName());
    (void)GetNetOps()->SetService(GetService());

    bRet = false;
    m_bConnect = false;

    // Set mode to use non-blocking sockets
    GetNetOps()->SetNonBlocking(true);

    //
    // Start the conversation to login
    //

    bRet = Yahoo_Login();
    GetNetOps()->Disconnect();
    if (bRet) {
      m_bConnect = bRet;
      return bRet;
    }
  }

  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Yahoo_Login
//   Description:
///   Login using Yahoo protocol
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::Yahoo_Login(void) {
  //
  // Note - if any Talk calls fail with a hang, this is mostly the
  // remote server closed the connection because it got input it wasn't
  // expecting e.g. a message missing a '\r\n'
  //
  std::string responses;
  std::string message;
  bool bRet = false;
  int read = 0;

  if (IsDebug())
    std::cout << "Attempting to connect to remote host..." << std::endl;

  // Connect to the remote host...
  if (!IsDryRun())
    bRet = GetNetOps()->Connect();
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return false;
  } else if (IsDebug())
    std::cout << "Remote connection was successful" << std::endl;

  MessagePair userName(std::make_pair(1, *GetUser()));
  YahooChatMsg login(0, YahooServices::Authent, YahooStatus::Available,
                     userName);
  login.Encode();

  if (IsDebug()) {
    login.PrintHexMsg(message);
    (void)DebugUtils::LogMessage(MSGINFO,
                                 "Debug: [%s,%d] Message length is %d bytes",
                                 __FILE__, __LINE__, login.GetMsgLen());
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Message text is '%s'",
                                 __FILE__, __LINE__, message.c_str());
  }

  if (!IsDryRun())
    bRet = GetNetOps()->SendBinMsg((void *)login.GetMsg(), login.GetMsgLen());
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (!IsDryRun()) {
    bool bCont = true;
    int count = 0;
    bRet = false;
    char *pcMess(0);

    // Set blocking mode to false
    GetNetOps()->SetBlock(false);
    GetNetOps()->SetSocketTimeOut(5000);

    while (bCont) {
      if (!GetNetOps()->GetBinMsg(&read, &pcMess)) {
        SetError(GetNetOps()->GetError());
        return bRet;
      }
      if (read > 0 || !responses.empty()) {
        bCont = false;
        bRet = true;
        break;
      }
      count++;
      if (count > 100) {
        // No response - give up
        SetError(" - remote server did not respond in a timely fashion");
        return bRet;
      }
    }

    YahooChatMsg loginReply(responses);
    if (IsDebug()) {
      loginReply.PrintHexMsg(message);
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, message.c_str());
    }
  }

  return false;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Disconnect
//   Description:
///   Disconnect from the messenger
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::Disconnect() {
  if (GetNetOps()) {
    if (IsConnected()) {
      GetNetOps()->Disconnect();
    }
  }
  m_bConnect = false;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   LaunchCallback
//   Description:
///   Launch the callback
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::RestartMonitor(void) {
  m_Thread.SetFunction(ProcessCallback);
  m_Thread.SetParam((void *)this);
#ifndef _WIN32
  m_Thread.SetAttribute(PTHREAD_CREATE_DETACHED);
#endif
  return (m_Thread.Start() == 0);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessCalls
//   Description:
///   An event loop which processes all the asynchronous calls and others
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::ProcessCalls(void) {
  bool bCont = true;
  std::string message;

  // Set blocking mode to false
  GetNetOps()->SetBlock(false);
  GetNetOps()->SetSocketTimeOut(5000);

  while (bCont) {
  }

  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ParseGrpAndUsrs
//   Description:
///   Parse users and groups ad add them to the list of contacts
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void Yahoo::ParseGrpAndUsrs(const std::string *pStr) { return; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ResetAlias
//   Description:
///   Reset my alias name
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::ResetAlias(const char *alias) {
  std::string whoStr = alias;
  return ResetAlias(&whoStr);
}

bool Yahoo::ResetAlias(const std::string *alias) { return true; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   YahooChat
//   Description:
///   Initiate an Yahoo chat
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::YahooChat(const std::string *ptr) { return true; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StartChat
//   Description:
///   Start a chat with someone
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Yahoo::StartChat(const char *who) {
  std::string whoStr = who;
  return StartChat(&whoStr);
}

bool Yahoo::StartChat(const std::string *who) { return true; }
