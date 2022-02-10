///
///   Utilities.cpp
///   MessengerUtils
///   Created by Tim Payne on 14/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include <fstream>
#include <iostream>
#include <stdarg.h>
#include <sys/stat.h>
#include <sys/types.h>

#ifndef _WIN32
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/param.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <syslog.h>
#include <unistd.h>
#else
#include <io.h>
#include <process.h>
#include <time.h>
#include <winsock.h>
#endif

#include "UtilityFuncs.h"

#ifdef _WIN32
#include "config_win32_vs2005.h"

extern bool CreateTagFile(void);
extern bool DeleteTagFile(void);
extern bool TestTagFile(void);
#endif

namespace {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   asyslogger
//   Description:
///   \brief Log a message to syslog
//   Parameters:
///   @param int msgLvl - Message code to use
///   @param const char* fmt - Message format
///   @param ... - variable argument list
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void asyslogger(int msgLvl, const char *fmt, ...) {
  std::string log;
  char buf[1024 * 4];
  va_list args;

  va_start(args, fmt);
  (void)vsprintf(buf, fmt, args);
  log.append(buf);
  va_end(args);

#ifdef _WIN32
  const char *t = log.c_str();
  int x = 0;
  const char *r = t;
  while (*r && r && *r != '\0') {
    if (*r == '\\n')
      x++;
    r++;
  }

  HANDLE hEvent;
  DWORD dwEventID = 0;
  WORD cInserts = (x) ? x : 1;
  LPCSTR szMsg = (LPCSTR)log.c_str();

  // Get a handle to the event log.
  hEvent = RegisterEventSource(NULL, CLIENTAPP);
  if (hEvent == NULL)
    return;
#endif
#ifndef _WIN32
  syslog(((msgLvl == MSGERRO) ? LOG_ERR : LOG_INFO), "%s\n", log.c_str());
#else
  // Report the event.
  (void)ReportEvent(hEvent, // Event log handle.
                    ((msgLvl == MSGERRO)
                         ? EVENTLOG_ERROR_TYPE
                         : EVENTLOG_INFORMATION_TYPE), // Event type.
                    0,                                 // Event category.
                    1,                                 // Event identifier.
                    NULL,     // No user security identifier.
                    cInserts, // Number of substitution strings.
                    0,        // No data.
                    &szMsg,   // Pointer to strings.
                    NULL);    // No data.
#endif
#ifdef _WIN32
  DeregisterEventSource(hEvent);
#endif
}
} // namespace

/// \namespace StrUtils
/// Addition string functions
namespace StrUtils {

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StrUtils::str2bool
//   Description:
///   \brief See if a string can be a bool
//   Parameters:
///   @param const char *val - String to process
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool str2bool(const char *val) {
  if (val == 0)
    return false;
  if (!strcasecmp(val, "true"))
    return true;
  else if (!strcasecmp(val, "on"))
    return true;
  else if (!strcasecmp(val, "yes"))
    return true;
  else if (!strcasecmp(val, "y"))
    return true;
  else if (!strcasecmp(val, "1"))
    return true;
  else if (!strcasecmp(val, "enabled"))
    return true;
  else if (!strcasecmp(val, "false"))
    return false;
  else if (!strcasecmp(val, "off"))
    return false;
  else if (!strcasecmp(val, "no"))
    return false;
  else if (!strcasecmp(val, "n"))
    return false;
  else if (!strcasecmp(val, "0"))
    return false;
  else if (!strcasecmp(val, "disabled"))
    return false;
  else
    return false;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StrUtils::SubStr
//   Description:
///   \brief String safe substr function
//   Parameters:
///   @param std::string& myStr - String to process
///   @param size_t start - first pos
///   @param size_t end - second pos
//   Return:
///   @return std::string
//   Notes:
//----------------------------------------------------------------------------
///

std::string SubStr(std::string &myStr, size_t start, size_t end) {
  size_t x = start;
  size_t y = end;
  if (x > myStr.size())
    x = myStr.size();
  if (y > myStr.size())
    y = myStr.size();

  return myStr.substr(x, y);
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StrUtils::Trim
//   Description:
///   \brief String safe whitespace trimming function
//   Parameters:
///   @param std::string& - String to trim
///   @param bool - Trim left
///   @param bool - Trim right
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void Trim(std::string &myStr, bool bLeft, bool bRight) {
  if (myStr.empty())
    return;

  size_t pos = myStr.size();
  char *tmpStr = (char *)calloc((pos + 1), sizeof(char));

  (void)strcpy(tmpStr, myStr.c_str());

  char *cc = tmpStr;

  if (bLeft) {
    while (cc && (isspace(*cc) || *cc == '\n' || *cc == '\r'))
      cc++;
  }

  (void)strcpy(tmpStr, cc);

  pos = strlen(tmpStr);
  cc = 0;

  if (pos) {
    if (bRight) {
      bool bChanged = false;
      cc = &(tmpStr[pos - 1]);
      while (cc && (isspace(*cc) || *cc == '\n' || *cc == '\r')) {
        bChanged = true;
        cc--;
      }
      if (cc == 0)
        *tmpStr = '\0';
      else {
        if (bChanged) {
          cc++;
          *cc = '\0';
        }
      }
    }
    myStr = tmpStr;
  } else
    myStr = "";

  free(tmpStr);

  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StrUtils::i2str
//   Description:
///   \brief Convert int to str
//   Parameters:
///   @param const int& val - value to use
///   @param std::string &outStr - string to convert
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void i2str(const int &val, std::string &outStr) {
  std::ostringstream str;
  str << val;
  outStr = str.str();
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   StrUtils::p2str
//   Description:
///   \brief Convert threadid to string
//   Parameters:
///   @param const THREADTYPE& val - pointer to thread to convert
///   @param std::string &outStr - string to use
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void p2str(const THREADTYPE &val, std::string &outStr) {
  std::ostringstream str;
  str << val;
  outStr += str.str();
  return;
}
} // namespace StrUtils

/// \namespace ArgUtils
/// Functions for manipulating function arrays
namespace ArgUtils {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   freeArgs
//   Description:
///	  \brief Free a char ** list
//   Parameters:
///   @param int argc - number of args
///   @param char **argv - array of args
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void freeArgs(int argc, char **argv) {
  if (argc) {
    int x = 0;
    while (x < argc)
      free(argv[x++]);
    (void)free((char **)argv);
  }
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   tokenCmd
//   Description:
///   \brief A simple command tokeniser to convert a std::string into a set of
///   parameterised char * arrays
//   Parameters:
///   @param int *argc - number of args
///   @param char ***argv - pointer to args
///   @param std::string *cmd - string to use
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void tokenCmd(int *argc, char ***argv, const std::string *cmd) {
  if (cmd && !cmd->empty()) {
    std::string token(cmd->c_str());
    size_t pos = 0;
    int counter = 0;

    // Tokenise the std::string
    while (!token.empty()) {
      StrUtils::Trim(token);
      pos = token.find(" ");
      if (pos == std::string::npos) {
        if (counter == 0)
          *argv = (char **)malloc(1 * sizeof(char *));
        else
          *argv = (char **)realloc(*argv, (counter + 1) * sizeof(char *));

        (*argv)[counter] = (char *)calloc(token.length() + 1, sizeof(char));
        (void)strcpy((*argv)[counter++], token.c_str());
        break;
      } else {
        if (counter == 0)
          *argv = (char **)malloc(1 * sizeof(char *));
        else
          *argv = (char **)realloc(*argv, (counter + 1) * sizeof(char *));

        (*argv)[counter] = (char *)calloc(token.length() + 1, sizeof(char));

        std::string tokenCpy = StrUtils::SubStr(token, 0, pos);
        (void)strcpy((*argv)[counter++], tokenCpy.c_str());
        token = StrUtils::SubStr(token, pos + 1, token.length());
      }
    }
    *argc = counter;
  }
  return;
}
} // namespace ArgUtils

/// \namespace FileUtils
/// Functions for manipulating files
namespace FileUtils {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   FileExists
//   Description:
///   \brief Check if a filename exists
//   Parameters:
///   @param std::string &fileName - filename to use
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool FileExists(std::string &fileName) {
  return (FileExists(fileName.c_str()));
}

bool FileExists(const char *fileName) {
  struct stat buf = {0};
  if (stat(fileName, &buf) != 0)
    return false;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetFileName
//   Description:
///   \brief Rip off directory names etc
//   Parameters:
///   @param std::string &fileName - filename to parse
//   Return:
///   @return std::string &
//   Notes:
//----------------------------------------------------------------------------
///

std::string &GetFileName(std::string &fileName) {
  if (fileName.find("/") != std::string::npos) {
    const char *file = strrchr(fileName.c_str(), '/');
    if (file) {
      file++;
      fileName = file;
    }
  } else if (fileName.find("\\") != std::string::npos) {
    const char *file = strrchr(fileName.c_str(), '\\');
    if (file) {
      file++;
      fileName = file;
    }
  } else if (fileName.find(":") != std::string::npos) {
    const char *file = strrchr(fileName.c_str(), ':');
    if (file) {
      file++;
      fileName = file;
    }
  }
  return fileName;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetTmpFilename
//   Description:
///   \brief Generate a temporary unique filename
//   Parameters:
///   @param std::string &fileName - filename to use
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool GetTmpFilename(std::string &fileName) {
  char lName[1024 + 1];
  const char *pTmpDir = 0;
#ifdef _WIN32
  pTmpDir = getenv("TEMP");
  if (!pTmpDir)
    pTmpDir = getenv("TMP");
  if (!pTmpDir)
    pTmpDir = "\\";
#else
  pTmpDir = "/tmp/";
#endif
  time_t ltime = 0;
  ltime = time(&ltime);
  if (ltime < 0)
    ltime = 123456;
  (void)sprintf(lName, "%s%smsn%#08x%#08x.tmp", pTmpDir, DIRSEP, getpid(),
                (unsigned int)ltime);
  fileName = lName;
  return true;
}
} // namespace FileUtils

#ifdef _WIN32

static std::string afileName;

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   CreateTagFile
//   Description:
//   Parameters:
//   Return:
///   bool
//   Notes:
//----------------------------------------------------------------------------
///

bool CreateTagFile(void) {
  FileUtils::GetTmpFilename(afileName);
  int fh = creat(afileName.c_str(), _S_IWRITE | _S_IREAD);
  if (fh == -1)
    return false;

  close(fh);
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   DeleteTagFile
//   Description:
//   Parameters:
//   Return:
///   bool
//   Notes:
//----------------------------------------------------------------------------
///

bool DeleteTagFile(void) {
  if (unlink(afileName.c_str()) != 0)
    return false;
  return true;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   TestTagFile
//   Description:
//   Parameters:
//   Return:
///   bool
//   Notes:
//----------------------------------------------------------------------------
///

bool TestTagFile(void) { return (FileUtils::FileExists(afileName)); }

#endif

/// \namespace SystemUtils
/// OS system support utilities
namespace SystemUtils {

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   runCommand
//   Description:
///   \brief Run a system command and send the result to a string
//   Parameters:
///   @param std::string& - command to run
///   @param std::string& - result of command
//   Return:
///   @return bool
//   Notes:
//----------------------------------------------------------------------------
///

bool runCommand(const std::string &cmdLine, std::string &result) {
  /// Get a temporary filename
  std::string tmpFile;
  FileUtils::GetTmpFilename(tmpFile);

  if (FileUtils::FileExists(tmpFile))
    (void)unlink(tmpFile.c_str());

  {
    std::ofstream outputFile(tmpFile.c_str(),
                             (std::ios::out | std::ios::trunc));
    if (outputFile.bad()) {
      (void)unlink(tmpFile.c_str());
      return false;
    }
  }

  std::string tmpCmd;
#ifdef _WIN32
#else
  tmpCmd = "(/bin/sh -c '";
  tmpCmd += cmdLine;
  tmpCmd += "' ) > ";
  tmpCmd += tmpFile;
  tmpCmd += " 2>&1";
#endif
  int ret = system(tmpCmd.c_str());
  if (ret < 0) {
    (void)unlink(tmpFile.c_str());
    return false;
  } else {
    std::ifstream outputFile(tmpFile.c_str(), std::ios::in);
    if (outputFile.bad()) {
      (void)unlink(tmpFile.c_str());
      return false;
    }

    char *tmp = new char[1024 + 1];
    int lineNo = 0;
    while (outputFile.good() && !outputFile.eof()) {
      lineNo++;
      outputFile.getline(tmp, 1024);
      result += tmp;
      result += "\n";
    }
    delete tmp;
  }
  (void)unlink(tmpFile.c_str());
  return true;
}
} // namespace SystemUtils

/// \namespace NetUtils
/// Addition network functions
#include "NetworkOps.h"

namespace NetUtils {
#define DNSLOOKUPSERV "checkip.dyndns.org:80"

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetInetAddrLocalIp
//   Description:
///   \brief Get an external facing IP addr for this machine from a remote
///   service
//   Parameters:
///   @param std::string& - IPaddr
//   Return:
///   @return std::string&
//   Notes:
//----------------------------------------------------------------------------
///
std::string &GetInetAddrLocalIp(std::string &addr) {
  NetworkOps netLookUp(DNSLOOKUPSERV);
  addr = "";

  if (netLookUp.Connect()) {
    std::string response;
    std::string message = "GET http://checkip.dyndns.org/ HTTP/1.0\r\n\r\n";

    if (netLookUp.Talk(&message, &response)) {
      netLookUp.Disconnect();
      std::string::size_type pos = response.find("Current IP Address:");
      if (pos != std::string::npos) {
        message = StrUtils::SubStr(response, pos, response.length());
        StrUtils::Trim(message);
        pos = message.find(":");
        addr = StrUtils::SubStr(message, (pos + 1), message.length());
        pos = addr.find("</body>");
        addr = StrUtils::SubStr(addr, 0, pos);
        StrUtils::Trim(addr);
      }
    }
  }

  return addr;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetIpAddr
//   Description:
///   \brief Get an IPaddr for a given node name
//   Parameters:
///   @param std::string& - host name
///   @param std::string& - address pointer
//   Return:
///   @return std::string&
//   Notes:
//----------------------------------------------------------------------------
///

std::string &GetIpAddr(std::string &hostName, std::string &addr) {
  if (hostName.empty()) {
    char lhostName[256 + 1];
    (void)gethostname(lhostName, sizeof(lhostName) - 1);
    hostName = lhostName;
  }

  struct hostent *host = 0;
  struct sockaddr_in sin = {0};

  if ((host = gethostbyname(hostName.c_str())) == (struct hostent *)0) {
    /// Can't find a hostname, so assume it is an inetaddr...
#ifndef _WIN32
    struct in_addr iAddr = {0};
    inet_aton(hostName.c_str(), &iAddr);
#else
    unsigned int iAddr = 0;
    iAddr = inet_addr(hostName.c_str());
#endif

    if ((host = gethostbyaddr((const char *)&iAddr, sizeof(iAddr), AF_INET)) ==
        (struct hostent *)0) {
      addr = "";
      return addr;
    }
  }

  sin.sin_family = host->h_addrtype;
  memcpy((char *)&(sin.sin_addr), host->h_addr, host->h_length);

#ifndef _WIN32
  char ciddr[128];
  if (inet_ntop(sin.sin_family, &sin.sin_addr, ciddr, sizeof(ciddr)) == NULL)
    addr = "";
  else
    addr = ciddr;
#else
  addr = inet_ntoa(sin.sin_addr);
#endif

  return addr;
}
} // namespace NetUtils

/// \namespace DebugUtils
/// Debugging utilities
namespace DebugUtils {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   LogMessage
//   Description:
///   \brief Log a message to output
//   Parameters:
///   @param int msgLvl - message level to use
///   @param const char* fmt - message format
///   @param ... - variable argument list
//   Return:
///   @return void
//   Notes:
//----------------------------------------------------------------------------
///

void LogMessage(int msgLvl, const char *fmt, ...) {
  std::string log;
  char buf[1024 * 4];
  va_list args;
  time_t ltime = time(&ltime);
  struct tm lm = {0};
  char timex[30];
#ifndef _WIN32
  (void)sprintf(buf, "%s", asctime_r(gmtime_r(&ltime, &lm), timex));
#else
  gmtime_s(&lm, &ltime);
  asctime_s(timex, 30, &lm);
  (void)sprintf(buf, "%s", timex);
#endif
  log = buf;
  StrUtils::Trim(log);
  log += ": ";

  va_start(args, fmt);
  (void)vsprintf(buf, fmt, args);
  log.append(buf);
  va_end(args);

  if (msgLvl == MSGERRO) {
    asyslogger(msgLvl, "%s\n", log.c_str());
    fprintf(stderr, "\n%s", log.c_str());
  } else {
    if (getenv("MSNAPP_LOGINFO"))
      asyslogger(msgLvl, "%s\n", log.c_str());

    fprintf(stdout, "\n%s", log.c_str());
  }

  return;
}
} // namespace DebugUtils

/// \namespace MsnUtils
/// MSN utilities
namespace MsnUtils {
#include "MsnMsg.h"

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   ParseChatLine
//   Description:
///   \brief Parse a chat line
//   Parameters:
///   @param std::string &ptrMessage
///   @param std::string &reply
///   @param bool peekOnly
///   @param bool bTrim
//   Return:
//   Notes:
//----------------------------------------------------------------------------
///

void MSNParseChatLine(std::string &ptrMessage, std::string &reply,
                      bool peekOnly, bool bTrim) {
  std::string message = ptrMessage;

  size_t pos = message.find("\r\n");
  if (pos == std::string::npos) {
    pos = message.find("\n");
    if (pos != std::string::npos)
      pos = pos + 1;
  } else
    pos = pos + 2;

  if (pos == std::string::npos) {
    if (bTrim)
      StrUtils::Trim(message);
    else
      StrUtils::Trim(message, true, false);
    reply = message;
    if (!peekOnly)
      ptrMessage = "";
    return;
  }

  std::string line = StrUtils::SubStr(message, 0, pos);
  if (bTrim)
    StrUtils::Trim(line);
  else
    StrUtils::Trim(line, true, false);

  reply = line;
  if (!peekOnly) {
    message = StrUtils::SubStr(message, pos, message.length());
    if (bTrim)
      StrUtils::Trim(message);
    else
      StrUtils::Trim(message, true, false);
    if (message.empty())
      ptrMessage = "";
    else
      ptrMessage = message;
  }
  return;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MSNGetPayload
//   Description:
///   \brief Get the payload for a message
//   Parameters:
///   @param std::string &message
//   Return:
///	  @return int
//   Notes:
//----------------------------------------------------------------------------
///

int MSNGetPayload(std::string &message) {
  if (message.empty())
    return -1;

  char tmpCmd[10];
  char tmpUsr[100];
  char tmpAlias[100];
  int payLoad;
  const char *tmpStr = NULL;

  ///   Look for the '\r' and clobber it to give me a useable std::string
  tmpStr = message.c_str();
  char *tmpa = (char *)strchr(tmpStr, '\r');
  if (tmpa)
    *tmpa = '\0';

  (void)sscanf(tmpStr, "%s %s %s %d", tmpCmd, tmpUsr, tmpAlias, &payLoad);
  payLoad = payLoad + strlen(tmpStr) + 2;
  return payLoad;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   MSNGetCookieId
//   Description:
///   \brief Get the cookie id for a message
//   Parameters:
///   @param const std::string *msg
//   Return:
///	  @return int
//   Notes:
//----------------------------------------------------------------------------
///

int MSNGetCookieId(const std::string *msg) {
  int cookieInvite;

  /// Get the cookie - if I can find it
  size_t pos = msg->find("Invitation-Cookie: ");
  if (pos != std::string::npos) {
    std::string message = *msg;
    std::string istr1 = StrUtils::SubStr(message, pos, message.length());
    std::string istr;
    MsnUtils::MSNParseChatLine(istr1, istr);
    StrUtils::Trim(istr);
    pos = istr.find(" ");
    istr = StrUtils::SubStr(istr, pos, istr.length());
    StrUtils::Trim(istr);
    cookieInvite = atoi(istr.c_str());
    return cookieInvite;
  } else
    return -1;
}
} // namespace MsnUtils

namespace HttpUtils {
///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   UrlEncodeString
//   Description:
///   \brief Encode a string to URL format
//   Parameters:
///   @param const std::string *urlString
///	  @param std::string &myString
//   Return:
///	  @return std::string &myString
//   Notes:
//----------------------------------------------------------------------------
///

std::string &UrlEncodeString(const std::string *urlString,
                             std::string &myString) {
  std::string astring(*urlString);
  return (UrlEncodeString(astring, myString));
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   UrlEncodeString
//   Description:
///   \brief Encode a string to URL format
//   Parameters:
///   @param const std::string &urlString
///	  @param std::string &myString
//   Return:
///	  @return std::string &myString
//   Notes:
//----------------------------------------------------------------------------
///

std::string &UrlEncodeString(const std::string &urlString,
                             std::string &myString) {
/// Define a couple of helper macros
#define isvalidUrlChar(c)                                                      \
  (isalpha(c) || isdigit(c) || c == 0x005f || c == 0x002d)
#define HexEncodeChar(str, c)                                                  \
  {                                                                            \
    char tmp[10];                                                              \
    (void)sprintf(tmp, "%%%.2x", c);                                           \
    str.append(tmp);                                                           \
  }

  if (!urlString.empty()) {
    int i = 0;
    std::string urlStr;
    const char *str = urlString.c_str();

    /// Skip down the string until we find a character that needs to be encoded
    /// This will be characters above 0x0FFF need to be encoded
    ///
    while (str[i] && *str) {
      /// If the character is lower ascii range or allowed, then copy it
      while (isvalidUrlChar(str[i])) {
        urlStr += str[i];
        i++;
      }
      if (str[i] == '\0' || *str == '\0')
        break;

      /// If the character is needing encoding, then encode it by coverting it
      /// to its hex code and adding it to the string
      HexEncodeChar(urlStr, str[i]);
      i++;
    }
    myString = urlStr;
  }
  return myString;
}

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   UrlDecodeString
//   Description:
///   \brief Decode a string from URL format
//   Parameters:
///   @param const std::string &urlString
///	  @param std::string &myString
//   Return:
///	  @return std::string &myString
//   Notes:
//----------------------------------------------------------------------------
///

std::string &UrlDecodeString(const std::string &urlString,
                             std::string &myString) {
  /*
#define SPC_BASE16_TO_10(x) (((x) >= '0' && (x) <= '9') ? ((x) - '0') : \
(toupper((x)) - 'A' + 10))

  char *spc_decode_url(const char *url, size_t *nbytes) {
          char       *out, *ptr;
          const char *c;

          if (!(out = ptr = strdup(url))) return 0;
          for (c = url;  *c;  c++) {
                  if (*c != '%' || !isxdigit(c[1]) || !isxdigit(c[2])) *ptr++ =
*c; else { *ptr++ = (SPC_BASE16_TO_10(c[1]) * 16) + (SPC_BASE16_TO_10(c[2])); c
+= 2;
                  }
          }
          *ptr = 0;
          if (nbytes) *nbytes = (ptr - out);
          return out;
  }	*/
  return myString;
}
} // namespace HttpUtils
