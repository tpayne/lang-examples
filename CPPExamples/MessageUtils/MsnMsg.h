///
///   MsnMsg.h
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __msnmsg_h_
#define __msnmsg_h_

#include <cstring>
#include <string>

class MSNChatMsg {
public:
  /// Public functions
  MSNChatMsg();
  MSNChatMsg(const char *, int len = 0);
  MSNChatMsg(const std::string &, int len = 0);

  ~MSNChatMsg();

  inline const std::string *GetMime() { return &m_mimeType; }
  inline const std::string *GetContentType() { return &m_contentType; }
  inline const std::string *GetIMAgent() { return &m_imAgent; }
  inline const std::string *GetIMFormat() { return &m_imFormat; }
  inline const std::string *GetMsgLine() { return &m_msgLine; }
  inline const std::string *GetUser() { return &m_typingUsr; }
  inline const std::string *GetAgent() { return &m_userAgent; }
  inline const int GetCookie() { return m_Cookie; }
  inline const std::string *GetMsg() { return &m_msgTxt; }
  inline const bool IsChat() { return m_chatLogging; }

  /// What type of message is this?
  inline const bool IsText() {
    return (m_contentType.find("text/plain") != std::string::npos);
  }
  inline const bool IsInvite() {
    return (m_contentType.find("text/x-msmsgsinvite") != std::string::npos);
  }

  inline void SetMime(const std::string &val) { m_mimeType = val; }
  inline void SetContentType(const std::string &val) { m_contentType = val; }
  inline void SetIMAgent(const std::string &val) { m_imAgent = val; }
  inline void SetIMFormat(const std::string &val) { m_imFormat = val; }
  inline void SetMsgLine(const std::string &val) { m_msgLine = val; }
  inline void SetUser(const std::string &val) { m_typingUsr = val; }
  inline void SetAgent(const std::string &val) { m_userAgent = val; }
  inline void SetMsg(const std::string &val) { m_msgTxt = val; }
  inline void SetChat(const bool val) { m_chatLogging = val; }
  inline void SetPayLoad(const int val) { m_Payload = val; }
  inline void SetCookie(int val) { m_Cookie = val; }

  inline int const size() { return m_msgTxt.size(); }
  inline int const GetPayLoad() { return m_Payload; }
  inline int const CalcPayLoad() {
    return m_msgTxt.size() + (m_msg.size() - 2);
  }

  std::string &ConstructTxtMsg();
  void GetMsgCode(std::string &);

private:
  void init();
  void clear();
  void ProcessChatResponse(const std::string &, int);
  void ProcessChatResponse(const char *, int);

  std::string m_mimeType;
  std::string m_contentType;
  std::string m_imAgent;
  std::string m_imFormat;
  std::string m_msgLine;
  std::string m_typingUsr;
  std::string m_userAgent;

  std::string m_msgTxt;
  std::string m_msg;
  bool m_chatLogging;
  int m_Payload;
  int m_Cookie;
};

#endif
