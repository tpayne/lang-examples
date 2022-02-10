///
///   YahooMsg.h
///   MessengerUtils
///   Created by Tim Payne on 10/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __yahoomsg_h_
#define __yahoomsg_h_

#include "YahooConstants.h"
#include <cstring>
#include <map>
#include <string>

class YahooChatMsg {
public:
  /// Public functions
  YahooChatMsg();
  YahooChatMsg(const std::string &);
  YahooChatMsg(unsigned int, unsigned int, unsigned int, MessagePair &);

  ~YahooChatMsg();

  inline const unsigned char *GetMsg() { return m_msgTxt; }
  inline const int GetMsgLen() { return m_Len; }
  bool Encode(void);
  bool AddMsg(MessagePair &);
  int const size();
  void PrintHexMsg(std::string &);

private:
  void init();
  void clear();
  int m_Len;
  unsigned int m_Id;
  unsigned int m_Service;
  unsigned int m_Status;
  unsigned char *m_msgTxt;
  std::map<int, std::string> m_Messages;
};

#endif
