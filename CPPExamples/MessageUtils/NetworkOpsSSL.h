///
///   NetworkOpsSSL.h
///   MessengerUtils
///   Created by Tim Payne on 29/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __networkopsssl_h_
#define __networkopsssl_h_

#include <cstring>
#include <thread>

#include "NetworkOps.h"
#include <openssl/err.h>
#include <openssl/ssl.h>

#define CAROOTFILE "calist.pem"

class NetworkOpsSSL : public NetworkOps {
public:
  ///
  /// Public functions
  ///
  NetworkOpsSSL();
  NetworkOpsSSL(const std::string *, const std::string *);
  NetworkOpsSSL(const char *);
  NetworkOpsSSL(const std::string *);
  ~NetworkOpsSSL();

  inline SSL_CTX *GetCTX() { return m_Ctx; }
  inline SSL *GetSSL() { return m_Ssl; }
  inline BIO *GetBIO() { return m_Sbio; }
  inline const std::string *GetPasswd() { return &m_Passwd; }

  inline void SetCTX(SSL_CTX *val) { m_Ctx = val; }
  inline void SetSSL(SSL *val) { m_Ssl = val; }
  inline void SetBIO(BIO *val) { m_Sbio = val; }
  inline void SetPasswd(const std::string *val) { m_Passwd = *val; }
  inline void SetPasswd(const char *val) { m_Passwd = val; }

  bool Connect(const std::string *, const std::string *);
  bool Disconnect(void);

protected:
  void init();
  void clear();
  bool initCTX(const std::string *, const std::string *);
  void clearCTX(void);

private:
  int ReadMsg(char **);
  int SendMsg(void *, int);

  SSL_CTX *m_Ctx;
  SSL *m_Ssl;
  BIO *m_Sbio;
  std::string m_Passwd;
};

#endif
