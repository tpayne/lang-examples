///
///   NetworkOpsSSL.cpp
///   MessengerUtils
///   Created by Tim Payne on 29/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "NetworkOpsSSL.h"

static char *shslmm = 0;

namespace {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   pem_passwd_cb
//   Description:
///   Password cllback for PEM processing
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///
static int pem_passwd_cb(char *buf, int size, int rwflag, void *password) {
  if (size < (int)strlen(shslmm) + 1)
    return (0);

  strcpy(buf, shslmm);
  return (strlen(shslmm));
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

NetworkOpsSSL::NetworkOpsSSL() { init(); }

NetworkOpsSSL::NetworkOpsSSL(const std::string *host,
                             const std::string *service) {
  init();

  SetHostName(host);
  SetService(service);
}

NetworkOpsSSL::NetworkOpsSSL(const std::string *host) {
  init();
  SetHostName(host);
}

NetworkOpsSSL::NetworkOpsSSL(const char *host) {
  init();
  SetHostName(host);
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

NetworkOpsSSL::~NetworkOpsSSL() {
  clear();
  (void)Disconnect();
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

void NetworkOpsSSL::clear() {
  clearCTX();
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   clearCTX
//   Description:
///   clear the class
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void NetworkOpsSSL::clearCTX(void) {
  if (GetSSL()) {
    (void)SSL_shutdown(GetSSL());
    SSL_free(GetSSL());
    SetSSL(0);
  }
  if (GetCTX()) {
    SSL_CTX_free(GetCTX());
    SetCTX(0);
  }
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Disconnect
//   Description:
///   Disconnect from remote host
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOpsSSL::Disconnect(void) {
  clearCTX();
  return NetworkOps::Disconnect();
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

void NetworkOpsSSL::init() {
  NetworkOps::init();
  m_Ctx = 0;
  m_Ssl = 0;
  m_Sbio = 0;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   initCTX
//   Description:
///   init the CTX object
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOpsSSL::initCTX(const std::string *chainFile,
                            const std::string *passwd) {
  SSL_CTX *ctx = 0;

  //
  // Load the SSL libraries etc
  //
  if (!GetBIO()) {
    SSL_library_init();
    SSL_load_error_strings();

    // Setup the error stream errors
    BIO *err = BIO_new_fp(stderr, BIO_NOCLOSE);
    SetBIO(err);
  }

  // Create the SSL context
  const SSL_METHOD *ctxMethod = SSLv23_method();
  ctx = SSL_CTX_new(ctxMethod);
  SetCTX(ctx);

  // Load the chain file
  if (!SSL_CTX_use_certificate_chain_file(ctx, chainFile->c_str())) {
    std::string errMsg = "- Unable to read the certificate file \"";
    errMsg += *chainFile;
    errMsg += "\"";
    SetError(&errMsg);
    return false;
  }

  SetPasswd(passwd);
  shslmm = (char *)passwd->c_str();

  SSL_CTX_set_default_passwd_cb(ctx, pem_passwd_cb);

  if (!SSL_CTX_use_PrivateKey_file(ctx, chainFile->c_str(), SSL_FILETYPE_PEM)) {
    std::string errMsg = "- Unable to read the certificate file(1) \"";
    errMsg += *chainFile;
    errMsg += "\"";
    SetError(&errMsg);
    return false;
  }

  if (!SSL_CTX_load_verify_locations(ctx, CAROOTFILE, 0)) {
    std::string errMsg = "- Unable to read the certificate file(2) \"";
    errMsg += CAROOTFILE;
    errMsg += "\"";
    SetError(&errMsg);
    return false;
  }

  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Connect
//   Description:
///   Connect to an SSL server
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOpsSSL::Connect(const std::string *chainFile,
                            const std::string *passwd) {
  // Connect to the remote server...
  if (!NetworkOps::Connect())
    return false;

  // Setup my SSL context...
  if (!initCTX(chainFile, passwd))
    return false;

  // Setup my SSL connection...
  SSL *ssl = SSL_new(GetCTX());
  BIO *sslbio = BIO_new_socket(GetSockId(), BIO_NOCLOSE);
  SSL_set_bio(ssl, sslbio, sslbio);
  SetSSL(ssl);

  if (SSL_connect(ssl) <= 0) {
    SetError(" - Failed to setup a valid SSL connection to remote host");
    return false;
  }

  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   SendMsg
//   Description:
///   Send a message to the remote host
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

int NetworkOpsSSL::SendMsg(void *pczMessage, int iMsgLen) {
  int writen = 0;
  char *tmp = 0;

  if (pczMessage == 0)
    return 0;

  tmp = (char *)pczMessage;

  writen = SSL_write(GetSSL(), tmp, iMsgLen);
  switch (SSL_get_error(GetSSL(), writen)) {
  case SSL_ERROR_NONE:
    if (iMsgLen != writen) {
      SetError(" - An incomplete SSL message was written ");
      return 0;
    }
    break;
  default: {
    SetError(" - A general SSL write error was detected ");
    return 0;
  } break;
  }
  return (writen);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ReadMsg
//   Description:
///   Read a message from the remote host
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

int NetworkOpsSSL::ReadMsg(char **ptrMessage) {
  char *ptr = 0;
  char *tmp = 0;
  int total_read = 0;
  int num_read = 1;
  int msgblk = 0;
  int nleft = 0;
  int rsize = 0;
  bool bErr = false;

  // Wait for something to read...
  (void)PollMsg(-1);

  msgblk = DBLOCK;
  ptr = (char *)calloc(msgblk + 1, sizeof(char));
  nleft = msgblk;
  rsize = msgblk;
  tmp = ptr;
  bool bCont = true;

  while (bCont) {
    num_read = SSL_read(GetSSL(), tmp, msgblk);
    if (num_read < 1) {
      bCont = false;
      bErr = true;
    }
    int err = SSL_get_error(GetSSL(), num_read);
    if (err == SSL_ERROR_NONE) {
      if (SSL_pending(GetSSL()) < 1)
        bCont = false;
    } else if (err == SSL_ERROR_WANT_READ) {
      bCont = true;
    } else if (err == SSL_ERROR_ZERO_RETURN) {
      // Socket has been closed on us cleanly
      bCont = false;
    } else if (err == SSL_ERROR_SYSCALL) {
      bErr = true;
      bCont = false;
      break;
    } else {
      int errCode = ERR_peek_last_error();
      std::string errLine;
      char error[1024 + 1];
      if (errCode == 0)
        errCode = errNo;

#ifndef _WIN32
      if (strerror_r(errCode, error, sizeof(error)) == 0)
        errLine += error;
#else
      if (strerror_s(error, sizeof(error), errCode) == 0)
        errLine += error;
#endif

      std::string errOut = (err == SSL_ERROR_SYSCALL)
                               ? " - SSL_ERROR_SYSCALL detected "
                               : " - general SSL read error detected ";
      errOut += errLine;
      SetError(&errOut);
      bErr = true;
      bCont = false;
      break;
    }
    total_read += num_read;
    if (bCont == false)
      break;
    rsize += num_read;
    nleft -= num_read;
    if (nleft <= 0) {
      /// Realloc memory on the fly///
      ptr = (char *)realloc((char *)ptr, rsize + 1);
      nleft = num_read;
      tmp = ptr;
    }
    tmp = (char *)(tmp + total_read);
    ///
    /// If data read on pipe is less than msgblk then
    /// we have (hopefully) we have finished reading
    /// so break from loop ^_^
    ///
    ///
    if (num_read < msgblk)
      break;
  }

  if (total_read == 0 || bErr) {
    free(ptr);
    *ptrMessage = 0;
    /// EOF error///
    return (-1);
  } else {
    *ptrMessage = ptr;
    return (1);
  }
}
