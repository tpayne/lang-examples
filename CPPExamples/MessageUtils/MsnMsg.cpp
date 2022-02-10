///
///  MsnMsg.cpp
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "MsnMsg.h"
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

MSNChatMsg::MSNChatMsg() { init(); }

MSNChatMsg::MSNChatMsg(const std::string &msg, int payLoad) {
  init();
  ProcessChatResponse(msg, payLoad);
}

MSNChatMsg::MSNChatMsg(const char *msg, int payLoad) {
  init();
  ProcessChatResponse(msg, payLoad);
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

MSNChatMsg::~MSNChatMsg() { clear(); }

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

void MSNChatMsg::clear() { return; }

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

void MSNChatMsg::init() {
  m_Payload = 0;
  m_Cookie = 0;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessChatResponse
//   Description:
///   \brief Strip the message from a general chat response
//   Parameters:
///	  @param const char *ptrMessage
///   @param int payLoad
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void MSNChatMsg::ProcessChatResponse(const char *ptrMessage, int payLoad) {
  const std::string message = ptrMessage;

  return (ProcessChatResponse(message, payLoad));
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ProcessChatResponse
//   Description:
///   \brief Strip the message from a general chat response
//   Parameters:
///	  @param const std::string &
///   @param int payLoad
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void MSNChatMsg::ProcessChatResponse(const std::string &ptrMessage,
                                     int payLoad) {
  std::string message = ptrMessage;
  std::string text;
  std::string line;

  size_t pos = message.find("MSG ");

  if (pos != std::string::npos && payLoad)
    message = StrUtils::SubStr(message, pos, payLoad);

  while (!message.empty()) {
    MsnUtils::MSNParseChatLine(message, line, false, false);

    if (line.find("MSG ") != std::string::npos) {
      StrUtils::Trim(line);
      SetMsgLine(line);
      continue;
    } else if (line.find("MIME-Version") != std::string::npos) {
      StrUtils::Trim(line);
      SetMime(line);
      continue;
    } else if (line.find("Content-Type") != std::string::npos) {
      StrUtils::Trim(line);
      SetContentType(line);
      continue;
    } else if (line.find("Client-Name") != std::string::npos) {
      StrUtils::Trim(line);
      SetIMAgent(line);
      continue;
    } else if (line.find("Chat-Logging") != std::string::npos) {
      StrUtils::Trim(line);
      SetChat(true);
      continue;
    } else if (line.find("X-MMS-IM-Format") != std::string::npos) {
      StrUtils::Trim(line);
      SetIMFormat(line);
      continue;
    } else if (line.find("User-Agent") != std::string::npos) {
      StrUtils::Trim(line);
      SetAgent(line);
      continue;
    } else if (line.find("TypingUser") != std::string::npos) {
      StrUtils::Trim(line);
      SetUser(line);
      SetChat(true);
      continue;
    } else {
      text += line;
      continue;
    }
  }

  if (!text.empty()) {
    SetMsg(text);

    /// Get the cookie - if I can find it
    pos = text.find("Invitation-Cookie: ");
    if (pos != std::string::npos) {
      std::string line1 = StrUtils::SubStr(text, pos, text.length());
      MsnUtils::MSNParseChatLine(line1, line);
      StrUtils::Trim(line);
      pos = line.find(" ");
      line = StrUtils::SubStr(line, pos, line.length());
      StrUtils::Trim(line);
      int cookie = atoi(line.c_str());
      SetCookie(cookie);
    }
  }
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ConstructTxtMsg
//   Description:
///   \brief Construct a MSN message string
//   Parameters:
//   Return:
///   @return std::string&
//   Notes:
//----------------------------------------------------------------------------
///

std::string &MSNChatMsg::ConstructTxtMsg(void) {
  m_msg = "\r\n";
  m_msg += *GetMime();
  m_msg += "\r\n";
  m_msg += *GetContentType();
  m_msg += "\r\n";
  if (!GetIMFormat()->empty()) {
    m_msg += *GetIMFormat();
    m_msg += "\r\n";
  }
  m_msg += "\r\n";
  return m_msg;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetMsgCode
//   Description:
///   \brief Get the message code for a chat
//   Parameters:
///   @param std::string& code
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void MSNChatMsg::GetMsgCode(std::string &code) {
  size_t pos = 0;
  std::string tmp;

  if (!GetMsgLine()->empty())
    tmp = *GetMsgLine();
  else
    tmp = *GetMsg();

  pos = tmp.find(" ");
  code = StrUtils::SubStr(tmp, 0, pos);
  StrUtils::Trim(code);

  return;
}