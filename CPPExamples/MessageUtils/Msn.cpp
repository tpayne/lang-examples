///
///   Msn.cpp
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

#include "Msn.h"
#include "MsnChatSessions.h"
#include "Msnlocale.h"
#include "Mutex.h"
#include "NetworkOpsSSL.h"
#include "UtilityFuncs.h"

namespace {
static Mutex TriId;

static void LockMutex(void) { TriId.Lock(); }

static void UnlockMutex(void) { TriId.Unlock(); }

static CALLBACKFUNC ProcessCallback(void *ptrClass) {
  Msn *msn = (Msn *)ptrClass;
  if (msn) {
    if (msn->IsDebug())
      std::cout << "Thread id: " << msn->GetThread()->GetThreadId()
                << std::endl;
    if (msn->ProcessCalls()) {
      msn->SetThreadState(1);
    } else
      msn->SetThreadState(-1);

    if (msn->IsDebug())
      (void)DebugUtils::LogMessage(
          MSGINFO, "Debug: [%s,%d] Process thread died unnaturally with %d",
          __FILE__, __LINE__, msn->GetThreadState());
  }
  return 0;
}

static CALLBACKFUNC ChatCallback(void *ptrClass) {
  MsnChatSessions *chat = (MsnChatSessions *)ptrClass;
  if (chat) {
    if (chat->IsDebug())
      std::cout << "Thread id: " << chat->GetThread()->GetThreadId()
                << std::endl;
    if (chat->Chat()) {
    }
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

Msn::Msn() { init(); }

Msn::Msn(const int argc, const char **argv) {
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

Msn::~Msn() {
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

void Msn::clear() {
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

void Msn::init() {
  MessengerApps::init();
  m_Thread.init();
  m_bConnect = false;
  m_TriId = 1;
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

bool Msn::ParseArgs(const int argc, const char **argv) {
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
      if (!strcasecmp(argv[i], "-msnhost")) {
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
        if (GetSymbol("MSN_USER")) {
          std::string msnUser = GetSymbol("MSN_USER");
          std::string userName =
              StrUtils::SubStr(msnUser, 0, msnUser.find(":"));
          std::string passWd = StrUtils::SubStr(
              msnUser, (msnUser.find(":")) + 1, msnUser.length());
          StrUtils::Trim(userName);
          StrUtils::Trim(passWd);
          SetUserName(userName);
          SetPasswd(passWd);
        }
      }
      if (GetHostName()->empty()) {
        if (GetSymbol("MSN_HOST")) {
          std::string msnHost = GetSymbol("MSN_HOST");
          StrUtils::Trim(msnHost);
          SetHostName(msnHost);
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

void Msn::Usage(const int argc, const char **argv) {
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

bool Msn::Connect() {
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

    // Try MSNP8 first...
    bRet = MSNP8_Login();
    if (bRet) {
      SetProtcol(MSNP8);
      bRet = MSNSynch();
      m_bConnect = bRet;
      return bRet;
    }
    // Try MSNP?? TODO
  }

  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MSNP8_Login
//   Description:
///   Login using MSNP8 protocol
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::MSNP8_Login(void) {
  //
  // Note - if any Talk calls fail with a hang, this is mostly the
  // remote server closed the connection because it got input it wasn't
  // expecting e.g. a message missing a '\r\n'
  //
  std::string responses;
  std::string message;
  bool bRet = false;

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

  // Get some machine details...
  bool bGuess = false;
  unsigned int x = 0;

#ifndef _WIN32
  struct utsname info = {0};

  {
    if (uname(&info) != 0)
      bGuess = true;

    // Get some locale details...
    (void)setlocale(LC_ALL, "");
    char *locale = setlocale(LC_CTYPE, NULL);
    char localeStr[256 + 1];
    (void)strncpy(localeStr, locale, 256);
    char *locLang = strchr(localeStr, '_');
    if (locLang)
      *locLang = '\0';

    x = Msnlocale::GetLocaleCode(localeStr);
    if (x == 0)
      bGuess = true;
  }
#else
  {
    // Get some locale details...
    (void)setlocale(LC_ALL, "");
    char *locale = setlocale(LC_CTYPE, NULL);
    char localeStr[256 + 1];
    (void)strncpy_s(localeStr, 256, locale, 256);
    char *locLang = strchr(localeStr, '_');
    if (locLang)
      *locLang = '\0';

    x = Msnlocale::GetLocaleCode(localeStr);
    if (x == 0)
      bGuess = true;
  }
#endif

  // Negotate protocols. For the moment, I will only support MSNP8 and CVR0
  // other protocols I coud support later and MSNP9, MSNC1 and MSNP10
  //
  message = "VER 1 MSNP8 CVR0\r\n";
  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (!IsDryRun()) {
    if (IsDebug())
      (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                   __LINE__, responses.c_str());
    // Check if response std::string has MSNP8 or CVR0...
    if (strstr(responses.c_str(), "MSNP8") == 0 &&
        strstr(responses.c_str(), "CVR0") == 0) {
      bRet = false;
      SetError("This MSN server does not support the necessary protocols for "
               "this client to work");
      return bRet;
    }
  }

  // Negotated the protocol, so next send the login std::string...

  // Build up client details. If don't know, make a guess...
  if (bGuess)
    message = "CVR 2 0x0409 win 4.10 i386 ";
  else {
    // Know what the client is, so...
    char *tmpStr = new char[4096 + 1];
#ifndef _WIN32
    snprintf(tmpStr, 4096, "CVR 2 %#06x %s %s %s ", x, info.sysname,
             info.release, info.machine);
#else
    _snprintf_s(tmpStr, 4096, 4096, "CVR 2 %#06x win 4.10 i386 ", x);
#endif
    message = tmpStr;
    delete tmpStr;
  }

  // Login std::string for MSN...
  message += CLIENTAPP;
  message += " ";
  message += CLIENTAPPVRS;
  message += " MSMSGS ";
  message += *GetUser();
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  message = "USR 3 TWN I ";
  message += *GetUser();
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  // Typical response will be a transfer such as
  //
  // XFR 3 NS 207.46.110.133:1863 0 65.54.239.211:1863\n
  // ice.microsoft.com http://messenger.msn.com\n\r
  //
  // When we get this then we need to terminate and reconnect to new server

  if (!IsDryRun()) {
    // Check if response std::string has XFR
    if (strstr(responses.c_str(), "XFR ")) {
      // Close connection
      GetNetOps()->Disconnect();

      size_t pos = 0;

      // Tokenise the std::string we have and get the details we need
      for (int xx = 0; xx < 3; xx++) {
        pos = responses.find(" ");
        responses = StrUtils::SubStr(responses, pos + 1, responses.length());
      }

      // Only need the first node given...
      size_t pos1 = responses.find(" ");
      message = StrUtils::SubStr(responses, 0, pos1);

      // Reset hostname - NetOps will deal with hostName/addr:<port> okay, so no
      // need to parse
      GetNetOps()->SetHostName(&message);

      // Reinvoke login with new details...
      return (MSNP8_Login());
    }

    // Save a copy of this response as we will need it for a future
    // challenge/response...
    std::string challengeURL = responses;
    responses = "";

    // So, we now have a valid MSN host except that we now need to authenticate
    // ourselves against the MSN passport server, i.e. nexus. This needs to be
    // done using a SSL connection...

    {
      NetworkOpsSSL nexus("nexus.passport.com:443");
      if (IsDebug())
        std::cout << "Attempting to connect to nexus passport host..."
                  << std::endl;

      // Connect to the remote host...
      std::string keyChain(KEYCHAIN);
      std::string passwd(KEYPWD);

      bRet = nexus.Connect(&keyChain, &passwd);
      if (!bRet) {
        SetError(nexus.GetError());
        return false;
      } else if (IsDebug())
        std::cout << "Remote connection was successful" << std::endl;

      responses = "";
      message = "GET /rdr/pprdr.asp HTTP/1.1\r\nUser-Agent: MyClient\r\nHost: ";
      message += *GetHostName();
      message += "\r\n\r\n";

      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, message.c_str());
      if (!nexus.Talk(&message, &responses)) {
        SetError(nexus.GetError());
        return false;
      }
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, responses.c_str());
    }

    // Check if we have a login server returned to us
    if (strstr(responses.c_str(), NEXUSLOGINKEY) == 0) {
      SetError("The MSN password server returned an unrecognised std::string");
      return false;
    }

    std::string passportHost = StrUtils::SubStr(
        responses, responses.find(NEXUSLOGINKEY), responses.length());
    passportHost = StrUtils::SubStr(passportHost, strlen(NEXUSLOGINKEY),
                                    passportHost.length());
    passportHost = StrUtils::SubStr(passportHost, 0, passportHost.find(","));
    std::string loginURL = StrUtils::SubStr(
        passportHost, passportHost.find("/"), passportHost.length());
    passportHost = StrUtils::SubStr(passportHost, 0, passportHost.find("/"));

    if (IsDebug())
      (void)DebugUtils::LogMessage(
          MSGINFO,
          "Debug: Attempting to connect to remote host \"%s\""
          "using URL \"%s\"",
          passportHost.c_str(), loginURL.c_str());

    {
      std::string port("443");
      NetworkOpsSSL nexus(&passportHost, &port);

      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO,
                                     "Attempting to connect to %s host...",
                                     passportHost.c_str());

      // Connect to the remote host...
      std::string keyChain(KEYCHAIN);
      std::string passwd(KEYPWD);

      bRet = nexus.Connect(&keyChain, &passwd);
      if (!bRet) {
        SetError(nexus.GetError());
        return false;
      } else if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO,
                                     "Remote connection was successful");

      responses = "";
      message = "GET ";
      message += loginURL;
      message += " HTTP/1.1\r\nAuthorization: Passport1.4 ";
      message +=
          "OrgVerb=GET,OrgURL=http%3A%2F%2Fmessenger%2Emsn%2Ecom,sign-in=";
      message += *GetUser();
      message += ",pwd=";
      message += *GetPasswd();
      message += ",";
      // Need the previous challengeURL saved so that can provide the required
      // response
      message += StrUtils::SubStr(challengeURL, challengeURL.find("lc="),
                                  challengeURL.length());
      message += "User-Agent: MSMSGS\r\n";
      message += "Host: ";
      message += *nexus.GetHostName();
      message +=
          "\r\nConnection: Keep-Alive\r\nCache-Control: no-cache\r\n\r\n";

      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, message.c_str());
      if (!nexus.Talk(&message, &responses)) {
        SetError(nexus.GetError());
        return false;
      }
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, responses.c_str());
    }

    // Need to see if I worked...
    if (strstr(responses.c_str(), "HTTP/1.1 200 OK\r\n") != 0) {
      // Final challenge/response to actually connect...
      message = "USR 4 TWN S ";
      if (strstr(responses.c_str(), NEXUSAUTHKEY)) {
        responses = StrUtils::SubStr(responses, responses.find(NEXUSAUTHKEY),
                                     responses.length());
        responses = StrUtils::SubStr(responses, strlen(NEXUSAUTHKEY),
                                     responses.length());
      } else {
        responses = StrUtils::SubStr(responses, responses.find(NEXUSAUTHKEYALT),
                                     responses.length());
        responses = StrUtils::SubStr(responses, strlen(NEXUSAUTHKEYALT),
                                     responses.length());
      }
      responses = StrUtils::SubStr(responses, 0, responses.rfind("'"));
      responses = StrUtils::SubStr(responses, (responses.find("'") + 1),
                                   responses.length());
      message += responses;
      message += "\r\n";

      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, message.c_str());
      if (!GetNetOps()->Talk(&message, &responses)) {
        SetError(GetNetOps()->GetError());
        return false;
      }
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, responses.c_str());

      if (strstr(responses.c_str(), " OK ")) {
        // User logged in okay
        size_t pos = 0;

        // Tokenise the std::string we have and get the details we need
        for (int xx = 0; xx < 4; xx++) {
          pos = responses.find(" ");
          responses = StrUtils::SubStr(responses, pos + 1, responses.length());
        }
        responses = StrUtils::SubStr(responses, 0, (responses.length() - 6));
        SetAlias(&responses);
        return (true);
      } else {
        SetError(" - Final login challenge failed ");
        return false;
      }
    } else if (strstr(responses.c_str(), "HTTP/1.1 401 Unauthorized\r\n") !=
               0) {
      SetError(" - The authentication server rejected the connection attempt - "
               "wrong password? ");
      return false;
    } else if (strstr(responses.c_str(), "HTTP/1.1 302 Found\r\n") != 0) {
      // Another re-direct...
      // TODO - code
      // Look for "Location:" get the URL, strip the
      // https://loginnet.passport.com/login2.srf?lc=1033
      // to get hostname and URL and then try again with the above stuff
      return false;
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

bool Msn::Disconnect() {
  if (GetNetOps()) {
    if (IsConnected()) {
      // Setup the message
      std::string message;
      std::string responses;

      if (GetProtocol() == MSNP8)
        message = "OUT\r\n";

      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, message.c_str());

      if (!IsDryRun())
        (void)GetNetOps()->Talk(&message, NULL, true);
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
///   SetMSNStatus
//   Description:
///   Set the status for the client
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::SetMSNStatus(const char *status) {
  std::string response;
  return SetMSNStatus(status, &response);
}

bool Msn::SetMSNStatus(const char *status, std::string *repStr) {
  std::string state;
  bool bRet = false;

  if (status == 0 || !IsConnected())
    return bRet;
  else {
    //
    // Accepted values are available, busy, idle, brb, away, phone or
    // out-to-lunch These get translated to
    // * NLN - Available
    // * BSY - Busy
    // * IDL - Idle
    // * BRB - Be Right Back
    // * AWY - Away
    // * PHN - On the Phone
    // * LUN - Out to Lunch
    //
    if (!strcasecmp(status, "available"))
      state = "NLN";
    else if (!strcasecmp(status, "busy"))
      state = "BSY";
    else if (!strcasecmp(status, "idle"))
      state = "IDL";
    else if (!strcasecmp(status, "brb"))
      state = "BRB";
    else if (!strcasecmp(status, "away"))
      state = "AWY";
    else if (!strcasecmp(status, "phone"))
      state = "PHN";
    else if (!strcasecmp(status, "out-to-lunch"))
      state = "LUN";
    else {
      SetError(" - An unrecognised status was specified ");
      return bRet;
    }
  }

  // Setup the message
  std::string message;
  std::string responses;

  message = "CHG ";
  message += *GetNTriId();
  message += " ";
  message += state;
  message += " 0\r\n";
  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  *repStr = responses;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MSNSynch
//   Description:
///   Synch status with server
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::MSNSynch(void) {
  bool bRet = false;

  // Setup the message
  std::string message;
  std::string responses;

  if (GetProtocol() == MSNP8) {
    message = "SYN ";
    message += *GetNTriId();
    message += " synchversion\r\n";
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  std::string groups;

  if ((responses.find("LSG") != std::string::npos) ||
      (responses.find("LST") != std::string::npos))
    groups = responses;

  m_bConnect = true;
  bRet = SetMSNStatus("available", &responses);

  if ((responses.find("LSG") != std::string::npos) ||
      (responses.find("LST") != std::string::npos))
    groups += responses;

  while ((responses.find("QNG") == std::string::npos) && bRet) {
    bRet = MSNPing(&responses);
    if ((responses.find("LSG") != std::string::npos) ||
        (responses.find("LST") != std::string::npos))
      groups += responses;
  }

  ParseGrpAndUsrs(&groups);
  return (RestartMonitor());
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

bool Msn::RestartMonitor(void) {
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
///   MSNPing
//   Description:
///   Ping the server
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::MSNPing(void) {
  std::string response;
  return MSNPing(&response);
}

bool Msn::MSNPing(std::string *respStr) {
  bool bRet = false;

  // Setup the message
  std::string message;
  std::string responses;

  message = "PNG\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  *respStr = responses;

  if (responses.empty())
    bRet = false;
  else
    bRet = true;

  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MD5Calc
//   Description:
///   Calc an MD5 hash checksum
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///
#include <openssl/md5.h>

bool Msn::MD5Calc(const std::string *val, std::string *hexCode) {
#define dc2hx(c) ((c < 10) ? (c + '0') : (c - 10 + 'a'))

  unsigned char ms5hash[MD5_DIGEST_LENGTH];
  unsigned char ms5str[(MD5_DIGEST_LENGTH * 2) + 1];
  size_t len = val->length();
  int x = 0;
  int y = 0;
  const char *s = val->c_str();

  // Use OpenSSL routines to generate a MD5 digest hash...
  MD5_CTX cb = {0};
  MD5_Init(&cb);
  MD5_Update(&cb, s, len);
  MD5_Final(ms5hash, &cb);

  // Use a bit of bitwise mapping to convert md5 digest to a std::string we can
  // use... This is a bit ugly, but does the job ^_^
  for (x = 0; x < MD5_DIGEST_LENGTH; x++) {
    y = ms5hash[x] % MD5_DIGEST_LENGTH;
    ms5str[x * 2] = dc2hx((ms5hash[x] - y) / MD5_DIGEST_LENGTH);
    ms5str[x * 2 + 1] = dc2hx(y);
  }

  ms5str[(MD5_DIGEST_LENGTH * 2)] = 0;
  *hexCode = (char *)ms5str;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MSNChallengeResponse
//   Description:
///   Response to a challenge request
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::MSNChallengeResponse(const std::string *challenge) {
  bool bRet = false;

  if (!IsConnected() || !challenge || challenge->empty())
    return false;

  // The challenge will be something like
  // CHL 0 15570131571988941333\r\n
  // We want the 3 std::string.
  std::string chlId = *challenge;
  chlId = StrUtils::SubStr(chlId, 6, 20);
  //
  // Need to add the product code for my fake msn client
  // Options are
  //
  // Client ID std::string		Client ID code
  //
  // msmsgs@msnmsgr.com 	Q1P7W2E4J9R8U3S5
  // PROD0038W!61ZTF9		VT6PX?UQTM4WM%YR
  // PROD0058#7IL2{QD		QHDCY@7R1TB6W?5B
  // PROD0061VRRZH@4F		JXQ6J@TUOGYV@N0M
  // PROD00504RLUG%WL		I2EBK%PYNLZL5_J4
  // PROD0076ENE8*@AW		CEQJ8}OE0!WTSWII
  //
  // Using MSN client
  //
  chlId += "Q1P7W2E4J9R8U3S5";
  (void)MD5Calc(&chlId, &chlId);

  // Setup the message
  std::string message;
  std::string responses;

  message = "QRY ";
  message += *GetNTriId();
  message += " msmsgs@msnmsgr.com 32\r\n";
  message += chlId;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  return true;
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

bool Msn::ProcessCalls(void) {
  bool bCont = true;
  std::string message;
  int read = 0;
  int count = 0;

  // Set blocking mode to false
  GetNetOps()->SetBlock(false);
  GetNetOps()->SetSocketTimeOut(5000);

  while (bCont) {
#ifdef _WIN32
    if (!TestTagFile()) {
      bCont = false;
      break;
    }
#endif
    while (!message.empty() && (read > 0)) {
      std::string msg2Process =
          StrUtils::SubStr(message, 0, message.find("\r\n"));
      std::string msnCode = StrUtils::SubStr(msg2Process, 0, message.find(" "));

      if (msnCode.empty())
        msnCode = StrUtils::SubStr(msg2Process, 0, message.find("\r"));
      if (msnCode.empty())
        StrUtils::Trim(message);
      else {
        if (msnCode == "QRY") {
        } else if (msnCode == "CHL") {
          // * CHL - Client challenge
          if (!MSNChallengeResponse(&msg2Process))
            std::cerr << GetNetOps()->GetError();
        } else if (msnCode == "FLN") {
          // * FLN - Principal signed off
          std::string contacts =
              StrUtils::SubStr(msg2Process, 5, msg2Process.length());
          RemoveContact(&contacts);
        } else if (msnCode == "NLN") {
          // * NLN - Principal changed presence/signed on
          std::string contacts =
              StrUtils::SubStr(msg2Process, 5, msg2Process.length());
          AddContact(&contacts);
        } else if (msnCode == "RNG" && IsMessagesAllowed()) {
          // * RNG - Client invited to chat session
          // RNG sessid address authtype ticket invitepassport invitename\r\n
          if (!MSNChat(&msg2Process))
            std::cerr << GetNetOps()->GetError();
        } else if (msnCode == "QNG") {
          // * Ping response - ignore for now
        } else {
        }
        message =
            StrUtils::SubStr(message, message.find("\r\n"), message.length());
        if (message == "\r\n")
          message = "";
      }
    }

    if (count > 180) {
      // We haven't seen any data for 100 times around. Is the socket okay?
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO,
                                     "Debug: [%s,%d] Doing remote socket check",
                                     __FILE__, __LINE__);

      if (!MSNPing(&message)) {
        // Oh dear, the socket seems to have gone south for the winter...
        bCont = false;
      }
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Socket seems %s",
                                     __FILE__, __LINE__,
                                     ((bCont) ? "ok" : "dead"));
      count = -1;
    }

    // If I read a message as a result of my ping - process it
    if (count == -1 && !message.empty()) {
    } else {
      if (!GetNetOps()->GetBinMsg(&read, message))
        bCont = false;
    }

    if (read > 0) {
      count = 0;
      if (IsDebug())
        (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                     __LINE__, message.c_str());
    } else
      count++;
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

void Msn::ParseGrpAndUsrs(const std::string *pStr) {
  // LSG is the keyword for groups
  // LST is the keyword for contacts

  // The LSG std::string is something like
  //  LSG 0 Other%20Contacts 0\r\n
  //  LSG 1 Coworkers 0\r\n
  //  LSG 2 Friends 0\r\n
  //  LSG 3 Family 0\r\n
  //
  std::string list = *pStr;

  size_t pos = 0;
  while ((pos = list.find("LSG")) != std::string::npos) {
    list = StrUtils::SubStr(list, (pos + 6), list.length());
    std::string n = StrUtils::SubStr(list, 0, list.find(" "));
    AddGroup(&n);
  }

  // Now do users
  // These are in the format
  //  LST dave@passport.com 1 1,2
  list = *pStr;

  while ((pos = list.find("LST")) != std::string::npos) {
    list = StrUtils::SubStr(list, (pos + 4), list.length());
    std::string n = StrUtils::SubStr(list, 0, list.find(" "));
    AddContact(&n);
  }

  return;
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

const std::string *Msn::GetNTriId() {
  char str[50 + 1];
  LockMutex();
  m_TriId++;
#ifndef _WIN32
  (void)sprintf(str, "%d", m_TriId);
#else
  (void)sprintf_s(str, 50, "%d", m_TriId);
#endif
  m_TriIdStr = str;
  UnlockMutex();
  return &m_TriIdStr;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   SetSwitchboardStatus
//   Description:
///   Tell the switchboard if I am accepting messages or not
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::SetSwitchboardStatus(bool bStatus) {
  bool bRet = false;

  // Setup the message
  std::string message;
  std::string responses;

  message = "IMS ";
  message += *GetNTriId();
  message += " ";
  message += (bStatus) ? "ON" : "OFF";
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  return true;
}

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

bool Msn::ResetAlias(const char *alias) {
  std::string whoStr = alias;
  return ResetAlias(&whoStr);
}

bool Msn::ResetAlias(const std::string *alias) {
  bool bRet = false;

  // Setup the message
  std::string message;
  std::string responses;

  message = "REA ";
  message += *GetNTriId();
  message += " ";
  message += *GetUser();
  message += " ";
  message += *alias;
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());
  if (responses.find("REA ") != std::string::npos)
    bRet = true;
  else
    bRet = false;

  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MSNChat
//   Description:
///   Initiate an MSN chat
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool Msn::MSNChat(const std::string *ptr) {
  std::string responses;
  bool bRet = false;

  // Function to process a comamnd like
  // RNG sessid address authtype ticket invitepassport invitename\r\n
  // e.g. RNG 68539665 65.54.228.22:1863 CKI 7923661.675614 example@hotmail.com
  // Mr Example

  // Parse the chat invite std::string
  std::string message = *ptr;
  message = StrUtils::SubStr(message, message.find(" ") + 1, message.length());
  std::string sbSession = StrUtils::SubStr(message, 0, message.find(" "));
  message = StrUtils::SubStr(message, message.find(" ") + 1, message.length());
  std::string sbHost = StrUtils::SubStr(message, 0, message.find(" "));
  message = StrUtils::SubStr(message, message.find(" ") + 1, message.length());
  message = StrUtils::SubStr(message, message.find(" ") + 1, message.length());
  std::string sbAuthStr = StrUtils::SubStr(message, 0, message.find(" "));
  message = StrUtils::SubStr(message, message.find(" ") + 1, message.length());
  std::string whoChat = StrUtils::SubStr(message, 0, message.find(" "));
  message = StrUtils::SubStr(message, message.find(" ") + 1, message.length());
  std::string whoChatAlias = StrUtils::SubStr(message, 0, message.find("\r\n"));

  // Connect to the switch board provided
  MsnChatSessions *sbRemoteHost = new MsnChatSessions(&sbHost, GetProtocol());

  sbRemoteHost->SetWho(&whoChat);
  sbRemoteHost->SetAlias(&whoChatAlias);
  sbRemoteHost->SetWhoAmI(GetUser());
  sbRemoteHost->SetWhoAmIAlias(GetAlias());
  sbRemoteHost->SetProtocol(GetProtocol());
  sbRemoteHost->SetDebug(IsDebug());
  sbRemoteHost->SetDryRun(IsDryRun());
  sbRemoteHost->GetNetOps()->SetNonBlocking(true);
  sbRemoteHost->GetNetOps()->SetDebug(IsDebug());

  if (!sbRemoteHost->GetNetOps()->Connect()) {
    SetError(sbRemoteHost->GetNetOps()->GetError());
    return false;
  }

  // Construct a hello message for the switch board...
  message = "ANS ";
  message += *GetNTriId();
  message += " ";
  message += *GetUser();
  message += " ";
  message += sbAuthStr;
  message += " ";
  message += sbSession;
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = sbRemoteHost->GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(sbRemoteHost->GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  // Register the chat callback and launch the process...
  sbRemoteHost->GetThread()->SetFunction(ChatCallback);
  sbRemoteHost->GetThread()->SetParam((void *)sbRemoteHost);
  sbRemoteHost->GetNetOps()->SetBlock(false);
  sbRemoteHost->SetReply2RemoteChat(true);
  if (GetFunction())
    sbRemoteHost->SetFunction(GetFunction());
  (void)sbRemoteHost->StartChat();

  GetChats()->push_back(sbRemoteHost);
  return true;
}

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

bool Msn::StartChat(const char *who) {
  std::string whoStr = who;
  return StartChat(&whoStr);
}

bool Msn::StartChat(const std::string *who) {
  bool bRet = false;

  // Set status online and available
  if (!SetMSNStatus("AVAILABLE")) {
    SetError(" - Unable to set status online");
    return bRet;
  }

  // Setup the message to request a switchboard session
  std::string message;
  std::string responses;

  message = "XFR ";
  message += *GetNTriId();
  message += " ";
  message += "SB\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (!bRet) {
    SetError(GetNetOps()->GetError());
    return bRet;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());
  ///
  /// Check status
  /// Need a std::string like "XFR 9 SB 207.46.108.46:1863 CKI
  /// 189597.1056411784.29994\r\n"
  ///
  StrUtils::Trim(responses);

  std::string sbHost = StrUtils::SubStr(responses, (responses.find("SB ") + 3),
                                        (responses.find("CKI") - 1));
  StrUtils::Trim(sbHost);
  sbHost = StrUtils::SubStr(sbHost, 0, sbHost.find(" "));

  std::string sbSession = StrUtils::SubStr(
      responses, (responses.find("CKI ") + 3), responses.length());
  StrUtils::Trim(sbHost);
  StrUtils::Trim(sbSession);

  // Connect to the switch board provided
  MsnChatSessions *sbRemoteHost = new MsnChatSessions(&sbHost, GetProtocol());

  sbRemoteHost->SetWho(who);
  sbRemoteHost->SetWhoAmI(GetUser());
  sbRemoteHost->SetWhoAmIAlias(GetAlias());

  sbRemoteHost->SetDebug(IsDebug());
  sbRemoteHost->SetDryRun(IsDryRun());
  sbRemoteHost->GetNetOps()->SetNonBlocking(true);

  if (!sbRemoteHost->GetNetOps()->Connect()) {
    SetError(sbRemoteHost->GetNetOps()->GetError());
    delete sbRemoteHost;
    return false;
  }

  /// Construct a hello message for the switch board...
  message = "USR ";
  message += *GetNTriId();
  message += " ";
  message += *GetUser();
  message += " ";
  message += sbSession;
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = sbRemoteHost->GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  // Check if I was cool with the MSN server...
  std::string code2Check = "USR ";
  code2Check += *GetCTriId();
  code2Check += " OK";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, code2Check.c_str());

  if (responses.find(code2Check) == std::string::npos) {
    SetError(" - The MSN switchboard rejected the attempt to initiate a chat "
             "session");
    delete sbRemoteHost;
    return false;
  }

  // Invite my victim into the parlor for dinner...
  message = "CAL ";
  message += *GetNTriId();
  message += " ";
  message += *who;
  message += "\r\n";

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, message.c_str());

  if (!IsDryRun())
    bRet = sbRemoteHost->GetNetOps()->Talk(&message, &responses);
  else
    bRet = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  code2Check = "CAL ";
  code2Check += *GetCTriId();
  code2Check += " RINGING";

  if (responses.find(code2Check) == std::string::npos) {
    code2Check = "217 ";
    code2Check += *GetCTriId();

    if (responses.find(code2Check) != std::string::npos) {
      code2Check = " - ";
      code2Check += *who;
      code2Check += " is not online";
    } else {
      code2Check = "";
      code2Check = "216 ";
      code2Check += *GetCTriId();

      if (responses.find(code2Check) != std::string::npos) {
        code2Check = " - ";
        code2Check += *who;
        code2Check += " has not authorised this contact to contact them";
      } else
        code2Check = "";
    }

    if (code2Check.empty()) {
      code2Check = " - ";
      code2Check += *who;
      code2Check += " did not accept the chat request";
    }

    SetError(&code2Check);
    delete sbRemoteHost;
    return false;
  }

  if (!IsDryRun())
    bRet = sbRemoteHost->GetNetOps()->Talk("", &responses);
  else
    bRet = true;

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] %s", __FILE__,
                                 __LINE__, responses.c_str());

  code2Check = "JOI ";
  code2Check += *who;

  if (responses.find(code2Check) == std::string::npos) {
    code2Check = "217 ";
    code2Check += *GetCTriId();

    if (responses.find(code2Check) != std::string::npos) {
      code2Check = " - ";
      code2Check += *who;
      code2Check += " is not online";
    } else {
      code2Check = "";
      code2Check = "216 ";
      code2Check += *GetCTriId();

      if (responses.find(code2Check) != std::string::npos) {
        code2Check = " - ";
        code2Check += *who;
        code2Check += " has not authorised this contact to contact them";
      } else
        code2Check = "";
    }

    if (code2Check.empty()) {
      code2Check = " - ";
      code2Check += *who;
      code2Check += " did not accept the chat request";
    }

    SetError(&code2Check);
    delete sbRemoteHost;
    return false;
  }

  // Register the chat callback and launch the process...
  sbRemoteHost->GetThread()->SetFunction(ChatCallback);
  sbRemoteHost->GetThread()->SetParam((void *)sbRemoteHost);
  sbRemoteHost->GetNetOps()->SetBlock(false);
  sbRemoteHost->SetReply2RemoteChat(false);
  if (GetFunction())
    sbRemoteHost->SetFunction(GetFunction());
  (void)sbRemoteHost->StartChat();

  GetChats()->push_back(sbRemoteHost);
  return true;
}
