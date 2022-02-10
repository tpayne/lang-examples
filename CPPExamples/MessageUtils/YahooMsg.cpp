///
///  YahooMsg.cpp
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "YahooMsg.h"
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

YahooChatMsg::YahooChatMsg() { init(); }

YahooChatMsg::YahooChatMsg(const std::string &message) {
  init();
  int len = message.size() + PACKETHRDLEN;
  m_msgTxt = (unsigned char *)calloc(len + 1, sizeof(unsigned char));

  (void)memmove(m_msgTxt, message.c_str(), message.size());
}

YahooChatMsg::YahooChatMsg(unsigned int sessionId, unsigned int service,
                           unsigned int status, MessagePair &msg) {
  init();
  m_Service = service;
  m_Status = status;
  m_Id = sessionId;
  AddMsg(msg);
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

YahooChatMsg::~YahooChatMsg() { clear(); }

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

void YahooChatMsg::clear() {
  if (m_msgTxt)
    free(m_msgTxt);
  m_Messages.clear();
  init();
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

void YahooChatMsg::init() {
  m_msgTxt = 0;
  m_Service = 0x0;
  m_Status = 0x0;
  m_Id = 0x0;
  m_Len = 0;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///	  AddMsg
//   Description:
///	  \brief Add a message
//   Parameters:
///	  @param MessagePair&
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool YahooChatMsg::AddMsg(MessagePair &msg) {
  m_Messages.insert(msg);
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///	  size
//   Description:
///	  \brief Return the size of the message
//   Parameters:
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

const int YahooChatMsg::size() {
  int lsize = 0;

  std::map<int, std::string>::const_iterator pos(m_Messages.begin());
  for (; pos != m_Messages.end(); pos++) {
    int x = pos->first;
    do {
      x /= 10;
      lsize++;
    } while (x);
    lsize = lsize + 2;
    lsize = lsize + pos->second.size();
    lsize = lsize + 2;
  }

  return lsize;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///	  Encode
//   Description:
///	  \brief Encode the message to the Yahoo "standard"
//   Parameters:
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool YahooChatMsg::Encode() {
#define ADDINT32(buffer, idx, value)                                           \
  {                                                                            \
    buffer[(idx)++] = (((value) >> 24) & 0xFF);                                \
    buffer[(idx)++] = (((value) >> 16) & 0xFF);                                \
    buffer[(idx)++] = (((value) >> 8) & 0xFF);                                 \
    buffer[(idx)++] = ((value)&0xFF);                                          \
  }

#define ADDINT16(buffer, idx, value)                                           \
  {                                                                            \
    buffer[(idx)++] = (((value) >> 8) & 0xFF);                                 \
    buffer[(idx)++] = ((value)&0xFF);                                          \
  }

  int len = this->size() + PACKETHRDLEN;
  m_msgTxt = (unsigned char *)calloc(len + 1, sizeof(unsigned char));

  /// Add message units
  (void)memmove(m_msgTxt, "YMSG", 4);
  m_Len = 4;
  ADDINT16(m_msgTxt, m_Len, 0x000C);
  ADDINT16(m_msgTxt, m_Len, 0x0000);
  ADDINT16(m_msgTxt, m_Len, this->size());
  ADDINT16(m_msgTxt, m_Len, m_Service);
  ADDINT32(m_msgTxt, m_Len, m_Status);
  ADDINT32(m_msgTxt, m_Len, m_Id);

  /// Process message pairs in the message buffer and add to the messsge
  std::map<int, std::string>::const_iterator ipos(m_Messages.begin());
  for (; ipos != m_Messages.end(); ipos++) {
    unsigned char tmp[50];
    (void)sprintf((char *)tmp, "%d", ipos->first);
    (void)memmove(m_msgTxt + m_Len, (char *)tmp, strlen((char *)tmp));
    m_Len += strlen((char *)tmp);
    m_msgTxt[m_Len++] = 0xc0;
    m_msgTxt[m_Len++] = 0x80;
    (void)memmove(m_msgTxt + m_Len, ipos->second.c_str(), ipos->second.size());
    m_Len += ipos->second.size();
    m_msgTxt[m_Len++] = 0xc0;
    m_msgTxt[m_Len++] = 0x80;
  }
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///	  PrintHexMsg
//   Description:
///	  \brief Print the message in debug mode
//   Parameters:
///   @param std::string &str
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void YahooChatMsg::PrintHexMsg(std::string &str) {
  if (m_msgTxt) {
    char tmp[20];
    int x = 0;
    str = "\"";
    for (x = 0; x < m_Len; x++) {
      if (isprint(m_msgTxt[x]))
        (void)sprintf(tmp, "%c ", m_msgTxt[x]);
      else
        (void)sprintf(tmp, "- ");

      str.append(tmp);
    }
    str += "\"\n\"";
    for (x = 0; x < m_Len; x++) {
      (void)sprintf(tmp, "%02x ", m_msgTxt[x]);
      str.append(tmp);
    }
    str += "\"\n";
  }
  return;
}
