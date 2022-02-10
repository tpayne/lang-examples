///
///   MessengerApps.cpp
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "MessengerApps.h"
#include "UtilityFuncs.h"

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

MessengerApps::MessengerApps() {
  init();
#ifdef _WIN32
  m_Ok = CreateTagFile();
#endif
}

MessengerApps::MessengerApps(const int argc, const char **argv) {
  init();
  m_Ok = ParseArgs(argc, argv);
#ifdef _WIN32
  if (m_Ok)
    m_Ok = CreateTagFile();
#endif
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

MessengerApps::~MessengerApps() {
#ifdef _WIN32
  (void)DeleteTagFile();
#endif
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

void MessengerApps::clear() {
  (void)GetNetOps()->Disconnect();
  (void)GetNetOpsSSL()->Disconnect();

  m_Users.clear();
  m_Groups.clear();
  m_Symbols.clear();

  for (Chats::iterator i = m_Chats.begin(); i != m_Chats.end(); ++i)
    delete *i;
  m_Chats.clear();

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

void MessengerApps::init() {
  m_Ok = false;
  m_AcceptMsg = true;
  m_Debug = false;
  m_DryRun = false;
  m_iConnectAttempts = 5;
  m_Callback = 0;
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

bool MessengerApps::ParseArgs(const int argc, const char **argv) {
  return false;
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

void MessengerApps::Usage(const int argc, const char **argv) { return; }

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

bool MessengerApps::Connect() { return false; }

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

bool MessengerApps::Disconnect() { return false; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   RemoveContact
//   Description:
///   Remove a user
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MessengerApps::RemoveContact(const std::string *contact) {
  std::string conN(contact->c_str());
  GetContacts()->remove(conN);
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   AddContact
//   Description:
///   Add a user
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MessengerApps::AddContact(const std::string *contact) {
  std::string conN(contact->c_str());
  GetContacts()->push_back(conN);
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   AddGroup
//   Description:
///   Add a group
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MessengerApps::AddGroup(const std::string *grp) {
  std::string grpN(grp->c_str());
  GetGroups()->push_back(grpN);
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ChatEstablished
//   Description:
///   Are we talking to this person already?
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool MessengerApps::ChatEstablished(const std::string *contact) {
  Chats::const_iterator it;
  for (it = m_Chats.begin(); it != m_Chats.end(); it++) {
    ChatSessions *chat = (*it);
    if (*contact == *chat->GetWho())
      return true;
  }
  return false;
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

bool MessengerApps::StartChat(const char *who) { return false; }

bool MessengerApps::StartChat(const std::string *who) { return false; }

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

bool MessengerApps::ResetAlias(const char *who) { return false; }

bool MessengerApps::ResetAlias(const std::string *who) { return false; }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ReadConfigFile
//   Description:
///   \brief Read a config file and set the variables
//   Parameters:
//   Return:
///	   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

#include <fstream>
#include <istream>

bool MessengerApps::ReadConfigFile() {
  if (GetConfigFile()->empty())
    return false;

  std::ifstream configFile(GetConfigFile()->c_str(), std::ifstream::in);
  if (configFile.bad())
    return false;

  m_Symbols.clear();

  char *tmp = new char[1024 + 1];

  std::string symbol;

  /// Open the configuration file for reading
  while (configFile.good() && !configFile.eof()) {
    configFile.getline(tmp, 1024);
    symbol = tmp;
    StrUtils::Trim(symbol);
    if (symbol.find("#") != std::string::npos) {
      if (symbol[0] == '#')
        continue;
    }
    if (symbol.find("=") != std::string::npos) {
      std::string symbolName = StrUtils::SubStr(symbol, 0, symbol.find("="));
      std::string symbolValue =
          StrUtils::SubStr(symbol, (symbol.find("=")) + 1, symbol.length());
      m_Symbols.insert(Symbols(symbolName, symbolValue));
    }
  }

  delete tmp;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetSymbol
//   Description:
///   \brief Get a symbol
//   Parameters:
///    @param const char *symbolName
//   Return:
///	   @return const char *
//   Notes:
//----------------------------------------------------------------------------
///

const char *MessengerApps::GetSymbol(const char *symbolName) {
  if (symbolName == NULL)
    return NULL;

  std::string symbol(symbolName);
  return (GetSymbol(symbol));
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetSymbol
//   Description:
///   \brief Get a symbol
//   Parameters:
///    @param std::string& symbolName
//   Return:
///	   @return const char *
//   Notes:
//----------------------------------------------------------------------------
///

const char *MessengerApps::GetSymbol(std::string &symbolName) {
  if (m_Symbols.find(symbolName) != m_Symbols.end())
    return m_Symbols[symbolName].c_str();
  else
    return NULL;
}
