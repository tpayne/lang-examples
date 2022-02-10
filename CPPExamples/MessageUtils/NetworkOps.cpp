///
///   NetworkOps.cpp
///   MessengerUtils
///   Created by Tim Payne on 24/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "NetworkOps.h"
#include "Mutex.h"
#include "UtilityFuncs.h"
#include <fcntl.h>
#include <iostream>

///
/// As this module may need to be threaded, we need a simple
/// mutex lock on critical calls such as network packet consuming
///
namespace {
static Mutex NetMutex;
static void LockMutex(void) { NetMutex.Lock(); }

static void UnlockMutex(void) { NetMutex.Unlock(); }

static void SetNonBlockingSocket(int sockId) {
  int options = 0;
#ifndef _WIN32
  if ((options = fcntl(sockId, F_GETFL, 0)) != -1) {
    options = (options | O_NONBLOCK | O_NOCTTY | O_NDELAY | O_RDWR | O_ASYNC);
    if (fcntl(sockId, F_SETFL, options) < 0) {
    }
  }
#else
  u_long nBlock = 1;
  if (ioctlsocket(sockId, FIONBIO, &nBlock) != 0) {
  }
#endif
  return;
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

NetworkOps::NetworkOps() { init(); }

NetworkOps::NetworkOps(const std::string *host, const std::string *service) {
  init();

  SetHostName(host);
  SetService(service);
}

NetworkOps::NetworkOps(const std::string *host) {
  init();
  SetHostName(host);
}

NetworkOps::NetworkOps(const char *host) {
  init();
  SetHostName(host);
}

NetworkOps::NetworkOps(const NetworkOps &val) {
  init();
  m_HostName = val.m_HostName;
  m_Service = val.m_Service;
  m_Debug = val.m_Debug;
  m_ErrorStr = val.m_ErrorStr;
  m_NonBlocking = val.m_NonBlocking;
  m_Block = val.m_Block;
  m_SocketId = val.m_SocketId;

#ifdef _WIN32
  m_Started = val.m_Started;
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

NetworkOps::~NetworkOps() { clear(); }

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Overrides
//   Description:
///   Operator overrides routines
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

// Overloading the == operator
bool NetworkOps::operator==(const NetworkOps &val) const {
  return (m_SocketId == val.m_SocketId && !m_HostName.compare(val.m_HostName) &&
          !m_Service.compare(val.m_Service));
}

// Overloading the != operator
bool NetworkOps::operator!=(const NetworkOps &other) const {
  return !(*this == other);
}

// Overloading the = operator
NetworkOps &NetworkOps::operator=(const NetworkOps &val) {
  if (this == &val)
    return *this;

  m_HostName = val.m_HostName;
  m_Service = val.m_Service;

  m_ErrorStr = val.m_ErrorStr;
  m_NonBlocking = val.m_NonBlocking;
  m_Block = val.m_Block;
  m_SocketId = val.m_SocketId;
  m_Debug = val.m_Debug;

#ifdef _WIN32
  m_Started = val.m_Started;
#endif

  return *this;
}

// Overloading the > operator
bool NetworkOps::operator>(const NetworkOps &other) const {
  return (m_SocketId > other.m_SocketId);
}

// Overloading the != operator
bool NetworkOps::operator<(const NetworkOps &other) const {
  return (m_SocketId < other.m_SocketId);
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

void NetworkOps::clear() {
  (void)Disconnect();
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

void NetworkOps::init() {
#ifdef _WIN32
  m_Started = false;
#endif
  m_SocketId = -1;
  m_NonBlocking = false;
  m_Block = true;
  m_Debug = false;
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ParseHost
//   Description:
///   Parse the host name and service into their appropriate members
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void NetworkOps::ParseHost() {

  if (GetHostName()->empty())
    return;

  if (strstr(GetHostName()->c_str(), ":")) {
    // We have a host with a port imbedded in it, we need to split this up
    std::string hostName = GetHostName()->substr(0, GetHostName()->find(":"));
    std::string serviceName = GetHostName()->substr(
        (GetHostName()->find(":")) + 1, GetHostName()->length());

    SetHostName(&hostName);
    SetService(&serviceName);
  }
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Connect
//   Description:
///   Connect to remote host
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::Connect(void) {
  LockMutex();
  struct servent *servp = 0;
  struct hostent *host = 0;
  struct sockaddr_in sin = {0};

  int channel = -1;

  if (GetHostName()->empty()) {
    UnlockMutex();
    return (false);
  }

  ParseHost();
  int portNo = (int)strtol(GetService()->c_str(), (char **)NULL, 10);

#ifdef _WIN32
  struct sockaddr peer = {0};
  int addrlen = 0;
  addrlen = sizeof(peer);
  if (!m_Started) {
    WSADATA wsData;
    WSAStartup(MAKEWORD(2, 0), &wsData);
    m_Started = true;
  }
#endif

  if (portNo < 1) {
    if ((servp = getservbyname(GetService()->c_str(), "tcp")) ==
        (struct servent *)0) {
      std::string errMsg("- TCP/IP name specified is invalid ");
      char error[1024 + 1];
#ifndef _WIN32
      if (strerror_r(errNo, error, sizeof(error)) == 0)
        errMsg += error;
#else
      if (strerror_s(error, sizeof(error), errNo) == 0)
        errMsg += error;
#endif
      SetError(&errMsg);
      UnlockMutex();
      return (false);
    }
    sin.sin_port = servp->s_port;
  } else
    sin.sin_port = htons(portNo);

  if ((host = gethostbyname(GetHostName()->c_str())) == (struct hostent *)0) {
    // Can't find a hostname, so assume it is an inetaddr...
#ifndef _WIN32
    struct in_addr iAddr = {0};
    inet_aton(GetHostName()->c_str(), &iAddr);
#else
    unsigned int iAddr = 0;
    iAddr = inet_addr(GetHostName()->c_str());
#endif

    if ((host = gethostbyaddr((const char *)&iAddr, sizeof(iAddr), AF_INET)) ==
        (struct hostent *)0) {
      std::string errMsg("- TCP/IP name specified is invalid ");
      char error[1024 + 1];
#ifndef _WIN32
      if (strerror_r(errNo, error, sizeof(error)) == 0)
        errMsg += error;
#else
      if (strerror_s(error, sizeof(error), errNo) == 0)
        errMsg += error;
#endif
      SetError(&errMsg);
      UnlockMutex();
      return (false);
    }
  }

  sin.sin_family = host->h_addrtype;
  memcpy((char *)&(sin.sin_addr), host->h_addr, host->h_length);

  if ((channel = socket(sin.sin_family, SOCK_STREAM, 0)) < 0) {
    SetError("- Socket initialisation failed");
    UnlockMutex();
    return (false);
  }

  // Set socket options
  int n = 1;
  if ((setsockopt(channel, SOL_SOCKET, SO_REUSEADDR, (char *)&n, sizeof(n)) <
       0) ||
      (setsockopt(channel, SOL_SOCKET, SO_KEEPALIVE, (char *)&n, sizeof(n)) <
       0)) {
    SetError("- Set socket options failed");
    UnlockMutex();
    return (false);
  }

  if (connect(channel, (struct sockaddr *)&sin, sizeof(sin)) < 0) {
    std::string errMsg("- Connection to server socket failed ");
    char error[1024 + 1];
#ifndef _WIN32
    if (strerror_r(errNo, error, sizeof(error)) == 0)
      errMsg += error;
#else
    if (strerror_s(error, sizeof(error), errNo) == 0)
      errMsg += error;
#endif
    SetError(&errMsg);
    UnlockMutex();
    return (false);
  }

  if (m_NonBlocking)
    SetNonBlockingSocket(channel);

  SetSockId(channel);
  UnlockMutex();
  return (true);
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

bool NetworkOps::Disconnect(void) {
  UnlockMutex();
  if (IsConnected())
    (void)closesk(GetSockId());
  init();
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Talk
//   Description:
///   \brief Have a talk with a remote host
//   Parameters:
///   @param const char* pczMessage
///   @param std::string *response
///   @param bool bforc
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::Talk(const char *pczMessage, std::string *response,
                      bool bforce) {
  std::string message(pczMessage);
  return Talk(&message, response, bforce);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   Talk
//   Description:
///   \brief Have a talk with a remote host
//   Parameters:
///   @param const std::string* pczMessage
///   @param std::string *response
///   @param bool bforc
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::Talk(const std::string *pczMessage, std::string *response,
                      bool bforce) {
  if (!IsConnected())
    return false;

  int iRet = -1;

  if (bforce)
    UnlockMutex();

  LockMutex();

  std::string message;

  if (pczMessage && !pczMessage->empty()) {
    message = pczMessage->c_str();
    //
    // Send a message to the server...
    //
    int iLen = SendMsg((void *)message.c_str(), message.length());

    if (iLen != (int)message.length()) {
      std::string errMsg("- A communications error occurred (1) ");
      char error[1024 + 1];
#ifndef _WIN32
      if (strerror_r(errNo, error, sizeof(error)) == 0)
        errMsg += error;
#else
      if (strerror_s(error, sizeof(error), errNo) == 0)
        errMsg += error;
#endif
      SetError(&errMsg);
      UnlockMutex();
      return false;
    }
  }

  if (response == NULL) {
    UnlockMutex();
    return true;
  }

  std::string reply;
  iRet = ReadMsg(reply);

  if (iRet < 0) {
    if (GetError()->empty()) {
      std::string errMsg("- A communications error occurred (1.1) ");
      char error[1024 + 1];
#ifndef _WIN32
      if (strerror_r(errNo, error, sizeof(error)) == 0)
        errMsg += error;
#else
      if (strerror_s(error, sizeof(error), errNo) == 0)
        errMsg += error;
#endif
      SetError(&errMsg);
    }
    UnlockMutex();
    return false;
  }

  *response = reply;
  UnlockMutex();
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   SendBinMsg
//   Description:
///   \brief Send a binary message to the remote host
//   Parameters:
///   @param void* pczMessage
///   @param int len
///   @param bool bforce
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::SendBinMsg(void *pczMessage, int iMsgLen, bool bforce) {
  if (!IsConnected())
    return false;

  if (bforce)
    UnlockMutex();

  LockMutex();
  int iRet = SendMsg(pczMessage, iMsgLen);
  bool bRet = (iRet == iMsgLen);
  UnlockMutex();
  return bRet;
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

int NetworkOps::SendMsg(void *pczMessage, int iMsgLen) {
  int writen = 0;
  int msgblk = DBLOCK;
  int msgsnt = 0;
  int msglft = iMsgLen;

  char *tmp = 0;

  if (pczMessage == 0)
    return 0;

  tmp = (char *)pczMessage;

  while (msglft > 0) {
    int i = 0;
    if (msglft < msgblk)
      i = msglft;
    else
      i = msgblk;

    do
      writen = send(GetSockId(), tmp, i, 0);
    while (writen < 0 && errNo == EINTR);

    msglft -= writen;
    msgsnt += writen;
    tmp = (char *)(tmp + writen);
    if (writen == 0)
      break;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Sent %d", __FILE__,
                                 __LINE__, msgsnt);

  return (msgsnt);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetMsg
//   Description:
///   \brief Wrapper public function to read a message
//   Parameters:
///   @param int *ptrRead
///   @param std::string message
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::GetBinMsg(int *ptrRead, std::string &message) {
  bool bRet = false;

  LockMutex();
  int read = ReadMsg(message);

  if (read < 0)
    *ptrRead = 0;
  else {
    bRet = true;
    *ptrRead = read;
  }
  UnlockMutex();
  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetMsg
//   Description:
///   \brief Wrapper public function to read a message
//   Parameters:
///   @param int *ptrRead
///   @param char **ptrMessage
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::GetBinMsg(int *ptrRead, char **ptrMessage) {
  bool bRet = false;
  char *pcMess(0);

  LockMutex();
  int read = ReadMsg(&pcMess);

  if (read < 0)
    *ptrRead = 0;
  else {
    bRet = true;
    *ptrRead = read;
  }
  *ptrMessage = pcMess;

  UnlockMutex();
  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ReadMsg
//   Description:
///   \brief Read a message from the remote host
//   Parameters:
///   @param std::string&
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

int NetworkOps::ReadMsg(std::string &message) {
  char *ptr(0);
  int len(0);

  len = ReadMsg(&ptr);
  if (len == 0) {
    message = "";
    return 0;
  } else if (len < 0) {
    message = "";
    return -1;
  }
  message = ptr;
  free(ptr);
  return len;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ReadMsg
//   Description:
///   \brief Read a message from the remote host
//   Parameters:
///   @param char **
//   Return:
///   @return int
//   Notes:
//----------------------------------------------------------------------------
///

int NetworkOps::ReadMsg(char **ptrMessage) {
  char *ptr = 0;
  char *tmp = 0;
  int total_read = 0;
  int num_read = 1;
  int msgblk = DBLOCK; ///    1K read///
  int nleft = 0;
  int rsize = 0;
  bool bCont = true;
  bool bErr = false;

  ptr = (char *)calloc(msgblk + 1, sizeof(char));
  nleft = msgblk;
  rsize = msgblk;
  tmp = ptr;

  /// Wait until something somes along to read///
  if (!GetBlock()) {
    if (!PollMsg(2)) {
      free(ptr);
      *ptrMessage = 0;
      return 0;
    }
  } else
    (void)PollMsg(-1);

  while (bCont) {
    do {
      num_read = recv(GetSockId(), tmp, msgblk, 0);
      if (num_read < 0) {
        if (errNo == EINTR) {
        } else if (errNo == EAGAIN || errNo == EWOULDBLOCK) {
          bCont = false;
          break;
        } else {
          bCont = false;
          break;
        }
      }
    } while (num_read < 0 && bCont);

    if (num_read < 0 && !(errNo == EAGAIN || errNo == EWOULDBLOCK)) {
      bErr = true;
      // An error occurred
      std::string errMsg("- An error occurred reading from a socket ");
      char error[1024 + 1];
#ifndef _WIN32
      if (strerror_r(errNo, error, sizeof(error)) == 0)
        errMsg += error;
#else
      if (strerror_s(error, sizeof(error), errNo) == 0)
        errMsg += error;
#endif
      SetError(&errMsg);
      break;
    }
    if (num_read == 0)
      break;
    total_read += num_read;
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

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Read %d '%s'",
                                 __FILE__, __LINE__, total_read,
                                 (ptr) ? ptr : "");

  if (total_read == 0) {
    free(ptr);
    *ptrMessage = 0;
    if (!bErr)
      return 0;
    /// EOF error///
    return (-1);
  } else {
    *ptrMessage = ptr;
    return (1);
  }
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   PollMsg
//   Description:
///   Function to see if message pending for reading
//   Parameters:
///   INT              secs    - Timeout period
//   Return:
///   INT 1 if pending, else 0
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::PollMsg(int secs) {
  fd_set readfds;
  int nbits = 0;
  int fds = 0;
  bool bRet = false;

  /// Time out period///
  struct timeval timeout = {0};
  struct timeval *timex = 0;

  if (GetSockId() >= fds)
    fds = GetSockId() + 1;
  else
    fds = GetSockId();

  FD_ZERO(&readfds);
  FD_SET(GetSockId(), &readfds);

  /// Timeout period in secs///
  timeout.tv_sec = secs;

  /// Select and process the results. Allow for signal delivery.///

  if (secs < 0)
    timex = 0;
  else
    timex = &timeout;

  nbits = select(fds, (fd_set *)&readfds, (fd_set *)0, (fd_set *)0,
                 (struct timeval *)timex);
  if (nbits > 0 && FD_ISSET(GetSockId(), &readfds))
    bRet = true;
  if (nbits < 0)
    bRet = false;

  return bRet;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   PeekMsg
//   Description:
///   Read a message from the mail host
//   Parameters:
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

int NetworkOps::PeekMsg(std::string *message) {
  LockMutex();

  int num_read = 0;
  char buffer[DBLOCK + 1];
  char *ptr = buffer;

  do {
    num_read = recv(GetSockId(), ptr, DBLOCK, MSG_PEEK);
    if (num_read != -1)
      break;
    else {
      if (errNo == EINTR || errNo == EAGAIN || errNo == EWOULDBLOCK) {
        num_read = 0;
      } else
        break;
    }
  } while (PollMsg(2));

  *message = buffer;
  UnlockMutex();
  return num_read;
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

int NetworkOps::ReadMsg(int iSize, std::string *pzMess) {
  int total_read = 0;
  int num_read = 1;
  int msgblk = DBLOCK; ///    1K read///
  int nleft = iSize + 24;
  bool bCont = true;
  bool bErr = false;

  /// Wait until something somes along to read///
  if (!GetBlock()) {
    if (!PollMsg(2))
      return 0;
  } else
    (void)PollMsg(-1);

  // Read until the socket is done...
  while (nleft > 0) {
    char *tmp = (char *)malloc(msgblk + 1);

    do {
      num_read = recv(GetSockId(), tmp, msgblk, 0);
      if (num_read < 0) {
        if (errNo == EINTR) {
        } else if (errNo == EAGAIN || errNo == EWOULDBLOCK) {
          bCont = false;
          break;
        } else {
          bCont = false;
          bErr = true;
        }
      }
    } while (num_read < 0 && bCont);

    if (num_read == 0)
      break;

    if (tmp) {
      *pzMess += tmp;
      (void)free(tmp);
    }
    total_read += num_read;
    nleft -= num_read;
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Read %d '%s'",
                                 __FILE__, __LINE__, total_read,
                                 pzMess->c_str());

  if (bErr)
    return (-1);
  else
    return (total_read);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   SetSocketTimeOut
//   Description:
///   Set the timeout period for a socket
//   Parameters:
///   int
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::SetSocketTimeOut(int millisecs) {
  struct timeval timer = {0};

  timer.tv_sec = millisecs / 1000;
  timer.tv_usec = (millisecs % 1000) * 1000;

  return (setsockopt(GetSockId(), SOL_SOCKET, SO_RCVTIMEO, (const char *)&timer,
                     sizeof(struct timeval)) == 0);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StartServer
//   Description:
///   \brief Start a network server on a port and listen to it
//   Parameters:
///   @param int connections
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::StartServer(int connections) {
  LockMutex();
  struct sockaddr_in sin = {0};

  int channel = -1;

  if (GetHostName()->empty() && GetService()->empty()) {
    UnlockMutex();
    return (false);
  }

  ParseHost();
  int portNo = -1;
  if (!GetService()->empty())
    portNo = (int)strtol(GetService()->c_str(), (char **)NULL, 10);
  else if (!GetHostName()->empty())
    portNo = (int)strtol(GetHostName()->c_str(), (char **)NULL, 10);

#ifdef _WIN32
  if (!m_Started) {
    WSADATA wsData;
    WSAStartup(MAKEWORD(2, 0), &wsData);
    m_Started = true;
  }
#endif

  memset((char *)&sin, 0, sizeof(sin));
  sin.sin_family = AF_INET;
  sin.sin_addr.s_addr = htonl(INADDR_ANY);
  sin.sin_port = htons(portNo);

  if ((channel = socket(sin.sin_family, SOCK_STREAM, 0)) < 0) {
    SetError("- Socket initialisation failed");
    UnlockMutex();
    return (false);
  }

  /// Set socket options
  int n = 1;
  if ((setsockopt(channel, SOL_SOCKET, SO_REUSEADDR, (char *)&n, sizeof(n)) <
       0) ||
      (setsockopt(channel, SOL_SOCKET, SO_KEEPALIVE, (char *)&n, sizeof(n)) <
       0)) {
    SetError("- Set socket options failed");
    UnlockMutex();
    return (false);
  }

  if (m_NonBlocking)
    SetNonBlockingSocket(channel);

  /// Bind the socket
  if (bind(channel, (struct sockaddr *)&sin, sizeof(sin)) < 0) {
    close(channel);
    // An error occurred
    std::string errMsg("- An error occurred binding ");
    char error[1024 + 1];
#ifndef _WIN32
    if (strerror_r(errNo, error, sizeof(error)) == 0)
      errMsg += error;
#else
    if (strerror_s(error, sizeof(error), errNo) == 0)
      errMsg += error;
#endif
    SetError(&errMsg);
    UnlockMutex();
    return (false);
  }

  if (IsDebug())
    (void)DebugUtils::LogMessage(MSGINFO, "Debug: [%s,%d] Started a listener",
                                 __FILE__, __LINE__);

  if (listen(channel, connections) < 0) {
    close(channel);
    // An error occurred
    std::string errMsg("- An error occurred listening ");
    char error[1024 + 1];
#ifndef _WIN32
    if (strerror_r(errNo, error, sizeof(error)) == 0)
      errMsg += error;
#else
    if (strerror_s(error, sizeof(error), errNo) == 0)
      errMsg += error;
#endif
    SetError(&errMsg);
    UnlockMutex();
    return (false);
  }

  SetSockId(channel);

  UnlockMutex();
  return (true);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   AcceptSingleConnection
//   Description:
///   \brief Accept a network connection and reset channel to talk to this port
//   Parameters:
///   @param void
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool NetworkOps::AcceptSingleConnection(void) {
  /// Wait for a connection to come in
  socklen_t addr_size;
  struct sockaddr_in peer = {0};
  addr_size = sizeof(peer);

  LockMutex();

  int newchannel = accept(GetSockId(), (struct sockaddr *)&peer, &addr_size);

  if (newchannel < 0) {
    // An error occurred
    std::string errMsg("- An error occurred reading from a socket ");
    char error[1024 + 1];
#ifndef _WIN32
    if (strerror_r(errNo, error, sizeof(error)) == 0)
      errMsg += error;
#else
    if (strerror_s(error, sizeof(error), errNo) == 0)
      errMsg += error;
#endif
    SetError(&errMsg);
    UnlockMutex();
    return false;
  }

  close(GetSockId());
  SetSockId(newchannel);

  if (IsDebug()) {
    std::string hostPeer;
    hostPeer = GetPeerIPAddr(hostPeer);
    (void)DebugUtils::LogMessage(
        MSGINFO, "Debug: [%s,%d] Got a connection to me from %s", __FILE__,
        __LINE__, hostPeer.c_str());
  }

  UnlockMutex();
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetHostIPAddr
//   Description:
///   \brief Get the IP for the remote host
//   Parameters:
///   @param std::string &ipAddr
//   Return:
///   @return std::string &
//   Notes:
//----------------------------------------------------------------------------
///

std::string &NetworkOps::GetHostIPAddr(std::string &ipAddr) {
  sockaddr_in addr = {0};
  int sin_size = sizeof(sockaddr_in);
  if (getsockname(GetSockId(), (sockaddr *)&addr, (socklen_t *)&sin_size) < 0)
    ipAddr = "";
  else
    ipAddr = inet_ntoa(addr.sin_addr);

  return ipAddr;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetPeerIPAddr
//   Description:
///   \brief Get the IP for the remote peer
//   Parameters:
///   @param std::string &ipAddr
//   Return:
///   @return std::string &
//   Notes:
//----------------------------------------------------------------------------
///

std::string &NetworkOps::GetPeerIPAddr(std::string &ipAddr) {
  sockaddr_in addr = {0};
  int sin_size = sizeof(sockaddr_in);
  if (getpeername(GetSockId(), (sockaddr *)&addr, (socklen_t *)&sin_size) < 0)
    ipAddr = "";
  else
    ipAddr = inet_ntoa(addr.sin_addr);

  return ipAddr;
}
