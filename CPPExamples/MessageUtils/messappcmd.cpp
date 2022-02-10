///
///   main.cpp
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

/*!
 \mainpage MessengerUtils Index Page

 \section Introduction

 This utility provides a set of classes that allow interactions with
 the popular IM utilities such as MSN and ICQ. The classes provided allow
 users to define callbacks which will then get invoked with a message and
 provide a response.

 Currently, this code only supports MSN and is in an alpha coding phase
*/

#include <cstring>
#include <iostream>
#include <locale.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>

/// Local includes
#include "Msn.h"
#include "Yahoo.h"

#include "UtilityFuncs.h"

namespace {

void initSignalHandlers();
static void signalHandler(int);

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   initSignalHandlers
//   Description:
///   \brief Register signal handlers
//   Parameters:
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void initSignalHandlers() {
#ifdef SIGILL
  (void)signal(SIGILL, signalHandler);
#endif ///    SIGILL///
#ifdef SIGTRAP
  (void)signal(SIGTRAP, signalHandler);
#endif ///    SIGTRAP///
#ifdef SIGABRT
  (void)signal(SIGABRT, signalHandler);
#endif ///    SIGABRT///
#ifdef SIGEMT
  (void)signal(SIGEMT, signalHandler);
#endif ///    SIGEMT///
#ifdef SIGFPE
  (void)signal(SIGFPE, signalHandler);
#endif ///    SIGFPE///
#ifdef SIGBUS
  (void)signal(SIGBUS, signalHandler);
#endif ///    SIGBUS///
#ifdef SIGSEGV
  (void)signal(SIGSEGV, signalHandler);
#endif ///    SIGSEGV///
#ifdef SIGSYS
  (void)signal(SIGSYS, signalHandler);
#endif ///    SIGSYS///
#ifdef SIGLOST
  (void)signal(SIGLOST, signalHandler);
#endif ///    SIGLOST///
#ifdef SIGHUP
  (void)signal(SIGHUP, signalHandler);
#endif ///    SIGHUP///
#ifdef SIGINT
  (void)signal(SIGINT, signalHandler);
#endif ///    SIGINT///
#ifdef SIGQUIT
  (void)signal(SIGQUIT, signalHandler);
#endif ///    SIGQUIT///
#ifdef SIGTERM
  (void)signal(SIGTERM, signalHandler);
#endif ///    SIGTERM///
#ifdef SIGXCPU
  (void)signal(SIGXCPU, signalHandler);
#endif ///    SIGXCPU///
#ifdef SIGXFSZ
  (void)signal(SIGXFSZ, signalHandler);
#endif ///    SIGXFSZ///
#ifdef SIGALRM
  (void)signal(SIGALRM, SIG_IGN);
#endif ///    SIGALRM///
#ifdef SIGVTALRM
  (void)signal(SIGVTALRM, SIG_IGN);
#endif ///    SIGVTALRM///
#ifdef SIGPROF
  (void)signal(SIGPROF, SIG_IGN);
#endif ///    SIGPROF///
#ifdef SIGUSR1
  (void)signal(SIGUSR1, SIG_IGN);
#endif ///    SIGUSR1///
#ifdef SIGUSR2
  (void)signal(SIGUSR2, SIG_IGN);
#endif ///    SIGUSR2///
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   signalHandler
//   Description:
///   \brief Handle unexpected signals
//   Parameters:
///   @param int  sig  - Signal number
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

static void signalHandler(int sig) {
  int status = EXIT_FAILURE;

  /// Test signal type///

  switch (sig) {
#ifdef SIGHUP
  case SIGHUP:
#endif ///    SIGHUP///
#ifdef SIGINT
  case SIGINT:
#endif ///    SIGINT///
#ifdef SIGQUIT
  case SIGQUIT:
#endif ///    SIGQUIT///
#ifdef SIGTERM
  case SIGTERM:
#endif ///    SIGTERM///
    status = EXIT_SUCCESS;
  default:
    break;
  }

  std::cerr << "Signal trap occurred!" << std::endl;

  /// Get a core file if unexpected signal///

  if (status != EXIT_SUCCESS)
    abort();

  exit(status);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessACmd
//   Description:
///   \brief A simple interactive shell to allow the user to enter commands to
///   talk to the MSN server
//   Parameters:
///   @param int argc - arguments
///   @param Msn  *cMsn - pointer to MSN object
///   @param char **argv - arguments to process
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void ProcessACmd(int argc, char **argv, Msn *cMsn) {
  if (argc == 0 || argv == 0 || cMsn == 0)
    return;

  /// Only limited commands supported currently
  if (!strcasecmp(argv[0], "DISCONNECT")) {
    if (cMsn->IsConnected()) {
      (void)cMsn->Disconnect();
      std::cout << "Disconnected" << std::endl;
    } else
      std::cout << "Not connected" << std::endl;
  } else if (!strcasecmp(argv[0], "CONNECT")) {
    if (cMsn->IsConnected())
      (void)cMsn->Disconnect();
    if (cMsn->Connect()) {
      std::cout << "Connect ok" << std::endl;
      std::cout << "MSN User " << cMsn->GetAlias()->c_str()
                << " has logged in successfully" << std::endl;
    } else {
      std::cout << "Connect failed" << std::endl;
      std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
    }
  } else if (!strcasecmp(argv[0], "STATUS")) {
    if (argc < 2)
      std::cout << "Status can be available, busy, idle, brb, away, phone or "
                   "out-to-lunch"
                << std::endl;
    else {
      if (!cMsn->SetMSNStatus(argv[1])) {
        std::cout << "Status command failed" << std::endl;
        std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
      }
    }
  } else if (!strcasecmp(argv[0], "SYNCH")) {
    if (!cMsn->MSNSynch()) {
      std::cout << "Synch command failed" << std::endl;
      std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
    }
  } else if (!strcasecmp(argv[0], "MD5")) {
    std::string val;
    std::string md5;
    if (argc < 2)
      std::cout << "MD5 <std::string>" << std::endl;
    else {
      val = argv[1];

      if (cMsn->MD5Calc(&val, &md5)) {
        std::cout << "MD5(\"" << val << "\") = " << md5 << std::endl;
      }
    }
  } else if (!strcasecmp(argv[0], "PING")) {
    if (!cMsn->MSNPing()) {
      std::cout << "Ping command failed" << std::endl;
      std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
    }
  } else if (!strcasecmp(argv[0], "CHALLENGE_TEST")) {
    std::string challengeTest("CHL 0 15570131571988941333\r\n");
    if (!cMsn->MSNChallengeResponse(&challengeTest)) {
      std::cout << "Challenge_test failed" << std::endl;
      std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
    }
  } else if (!strcasecmp(argv[0], "PROCESSCALLS_TEST")) {
    if (!cMsn->ProcessCalls()) {
      std::cout << "PROCESSCALLS_TEST failed" << std::endl;
      std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
    }
  } else if (!strcasecmp(argv[0], "LIST")) {
    if (!cMsn->GetGroups()->empty()) {
      std::cout << std::endl << "List of Groups" << std::endl;
      std::list<std::string>::iterator it;
      for (it = cMsn->GetGroups()->begin(); it != cMsn->GetGroups()->end();
           it++) {
        std::string str = *(it);
        std::cout << "\tGroup Name: \"" << str << "\"" << std::endl;
      }
    }
    if (!cMsn->GetContacts()->empty()) {
      std::cout << std::endl << "List of Contacts" << std::endl;
      std::list<std::string>::iterator it;
      for (it = cMsn->GetContacts()->begin(); it != cMsn->GetContacts()->end();
           it++) {
        std::string str = *(it);
        std::cout << "\tContact Name: \"" << str << "\"" << std::endl;
      }
    }
  } else if (!strcasecmp(argv[0], "MESSAGES")) {
    if (argc < 2)
      std::cout << "MESSAGES ON|OFF" << std::endl;
    else {
      if (!strcasecmp(argv[1], "ON")) {
        cMsn->SetMessagesAllowed(true);
        cMsn->SetSwitchboardStatus(true);
      } else if (!strcasecmp(argv[1], "OFF")) {
        cMsn->SetMessagesAllowed(false);
        cMsn->SetSwitchboardStatus(false);
      }
    }
  } else if (!strcasecmp(argv[0], "CHAT")) {
    if (argc < 2)
      std::cout << "CHAT <userName>" << std::endl;
    else {
      if (!cMsn->StartChat(argv[1])) {
        std::cout << "CHAT failed" << std::endl;
        std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
      }
    }
  } else if (!strcasecmp(argv[0], "ALIAS")) {
    if (argc < 2)
      std::cout << "ALIAS <newAlias>" << std::endl;
    else {
      if (!cMsn->ResetAlias(argv[1])) {
        std::cout << "ALIAS failed" << std::endl;
        std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
      }
    }
  } else if (!strcasecmp(argv[0], "RESTART")) {
    if (!cMsn->RestartMonitor()) {
      std::cout << "RESTART failed" << std::endl;
      std::cout << "Error: " << cMsn->GetError()->c_str() << std::endl;
    }
  } else
    std::cout << "Unrecognised command" << std::endl;

  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessACmd
//   Description:
///   \brief A simple interactive shell to allow the user to enter commands to
///   talk to the Yahoo server
//   Parameters:
///   @param int argc - arguments
///   @param Yahoo  *cYahoo - pointer to Yahoo object
///   @param char **argv - arguments to process
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void ProcessACmd(int argc, char **argv, Yahoo *cYahoo) {
  if (argc == 0 || argv == 0 || cYahoo == 0)
    return;

  /// Only limited commands supported currently
  if (!strcasecmp(argv[0], "DISCONNECT")) {
    if (cYahoo->IsConnected()) {
      (void)cYahoo->Disconnect();
      std::cout << "Disconnected" << std::endl;
    } else
      std::cout << "Not connected" << std::endl;
  } else if (!strcasecmp(argv[0], "CONNECT")) {
    if (cYahoo->IsConnected())
      (void)cYahoo->Disconnect();
    if (cYahoo->Connect()) {
      std::cout << "Connect ok" << std::endl;
      std::cout << "Yahoo User " << cYahoo->GetAlias()->c_str()
                << " has logged in successfully" << std::endl;
    } else {
      std::cout << "Connect failed" << std::endl;
      std::cout << "Error: " << cYahoo->GetError()->c_str() << std::endl;
    }
  } else
    std::cout << "Unrecognised command" << std::endl;

  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessCmd
//   Description:
///   \brief A simple interactive shell to allow the user to enter commands to
///   talk to the MSN server
//   Parameters:
///   @param Msn	*cMsn - pointer to MSN object
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void ProcessCmd(Msn *cMsn) {
  std::string command;
  bool bCont = true;
  char *lineIn = new char[1024 + 1];

  std::cout << "cmd> ";

  while (bCont) {
    std::cin.getline(lineIn, 1024);
    command = lineIn;

    char **argv = 0;
    int argc = 0;

    ArgUtils::tokenCmd(&argc, &argv, &command);
    if (argc == 0) {
    } else {
      if (!strcasecmp(argv[0], "QUIT"))
        bCont = false;
      else
        ProcessACmd(argc, argv, cMsn);
    }
    ArgUtils::freeArgs(argc, argv);
    std::cout << "cmd> ";
  }
  delete lineIn;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessCmd
//   Description:
///   \brief A simple interactive shell to allow the user to enter commands to
///   talk to the Yahoo server
//   Parameters:
///   @param Yahoo	*cYahoo - pointer to Yahoo object
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void ProcessCmd(Yahoo *cYahoo) {
  std::string command;
  bool bCont = true;
  char *lineIn = new char[1024 + 1];

  std::cout << "cmd> ";

  while (bCont) {
    std::cin.getline(lineIn, 1024);
    command = lineIn;

    char **argv = 0;
    int argc = 0;

    ArgUtils::tokenCmd(&argc, &argv, &command);
    if (argc == 0) {
    } else {
      if (!strcasecmp(argv[0], "QUIT"))
        bCont = false;
      else
        ProcessACmd(argc, argv, cYahoo);
    }
    ArgUtils::freeArgs(argc, argv);
    std::cout << "cmd> ";
  }
  delete lineIn;
  return;
}
} // namespace

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   main
//   Description:
///   \brief Main routine
//   Parameters:
///   @param int argc - number of arguments
///   @param char **argv - array of arguments
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

int main(const int argc, const char **argv) {
  int iStatus = EXIT_SUCCESS;

#ifdef UNIX
  initSignalHandlers();
#endif

#if !defined(NO_LOCALE)
  (void)setlocale(LC_ALL, "");
#endif ///    !defined(NO_LOCALE)///

  if (argc > 1) {
    if (!strcasecmp(argv[1], "msn")) {
      Msn cMsn(argc, argv);
      if (cMsn.IsOk()) {
        ProcessCmd(&cMsn);
      } else
        cMsn.Usage(argc, argv);
    } else if (!strcasecmp(argv[1], "yahoo")) {
      Yahoo cYahoo(argc, argv);
      if (cYahoo.IsOk()) {
        ProcessCmd(&cYahoo);
      } else
        cYahoo.Usage(argc, argv);
    } else {
      std::cout << "Unknown option!" << std::endl;
    }
  }

  std::cout << "Goodbye!" << std::endl;
  return (iStatus);
}
