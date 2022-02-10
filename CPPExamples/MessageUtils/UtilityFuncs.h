///
///   Utilities.h
///   MessengerUtils
///   Created by Tim Payne on 14/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __UtilityFuncs_h_
#define __UtilityFuncs_h_

#include <cstring>
#include <sstream>

#include "Threads.h"
#include <stdlib.h>

#ifdef _WIN32
#include "config_win32_vs2005.h"
#define DIRSEP "\\"
extern bool CreateTagFile(void);
extern bool DeleteTagFile(void);
extern bool TestTagFile(void);
#else
#define DIRSEP "/"
#endif

#ifndef O_BINARY
#define O_BINARY 0
#endif

#define MSGINFO 1
#define MSGERRO 2

#define CLIENTAPP "MSNMESSAPP"
#define CLIENTAPPVRS "1.0"

namespace ArgUtils {
extern void freeArgs(int, char **);
extern void tokenCmd(int *, char ***, const std::string *);
} // namespace ArgUtils

namespace StrUtils {
extern void Trim(std::string &, bool bLeft = true, bool bRight = true);
extern std::string SubStr(std::string &, size_t, size_t);
extern void i2str(const int &, std::string &);
extern void p2str(const THREADTYPE &, std::string &);
extern bool str2bool(const char *);
} // namespace StrUtils

namespace DebugUtils {
extern void LogMessage(int, const char *, ...);
}

namespace FileUtils {
extern bool GetTmpFilename(std::string &);
extern std::string &GetFileName(std::string &);
extern bool FileExists(std::string &);
extern bool FileExists(const char *);
} // namespace FileUtils

namespace SystemUtils {
extern bool runCommand(const std::string &, std::string &);
}

namespace NetUtils {
extern std::string &GetInetAddrLocalIp(std::string &);
extern std::string &GetIpAddr(std::string &, std::string &);
} // namespace NetUtils

namespace MsnUtils {
extern void MSNParseChatLine(std::string &, std::string &,
                             bool peekOnly = false, bool bTrim = true);
extern int MSNGetPayload(std::string &);
extern int MSNGetCookieId(const std::string *);
} // namespace MsnUtils

namespace HttpUtils {
extern std::string &UrlEncodeString(const std::string &, std::string &);
extern std::string &UrlEncodeString(const std::string *, std::string &);
extern std::string &UrlDecodeString(const std::string &, std::string &);
} // namespace HttpUtils

#endif
