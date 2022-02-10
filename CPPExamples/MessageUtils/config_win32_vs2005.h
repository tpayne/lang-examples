/*
 *  config_win32_vs2005.h
 *  MessengerUtils
 *
 *  Created by Tim Payne on 02/10/2008.
 *  Copyright 2008 __MyCompanyName__. All rights reserved.
 *
 */

#if defined(_WIN32) || defined(WIN32)

#ifndef __config_win32_vs2005_h__
#define __config_win32_vs2005_h__

#if !defined(strcasecmp)
#define strcasecmp _stricmp
#endif

#define getpid _getpid
#define creat _creat
#define close _close
#define stat _stat
#define unlink _unlink
#define chmod _chmod
#define access _access_s
#define open _open
#define read _read
#define O_BINARY _O_BINARY
#define O_RDONLY _O_RDONLY
#define F_OK 00
#define W_OK 02
#define R_OK 04

#endif
#endif
