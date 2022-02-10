///
///   YahooConstants.h
///   MessengerUtils
///   Created by Tim Payne on 24/09/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#ifndef __yahooconstants_h__
#define __yahooconstants_h__

#include <set>
#include <string>

/// Protocol headers

/// Yahoo services
namespace YahooServices {
enum Services {
  ADDBUDDY = 0x83,
  ADDIDENT, /* 0x10 */
  ADDIGNORE,
  Authent = 0x57,
  AUTHRESP = 0x54,
  CALENDAR,
  CHATEXIT = 0x9b,
  CHATGOTO,
  CHATINVITE,
  CHATJOIN, /* > 1 104-room 129-1600326591 62-2 */
  CHATLEAVE,
  CHATLOGOFF,
  CHATLOGON,
  CHATLOGOUT = 0xa0,
  CHATMSG = 0x20,
  CHATONLINE = 0x96, /* > 109(id), 1, 6(abcde) < 0,1*/
  CHATPING,
  COMMENT = 0xa8,
  CONFADDINVITE,
  CONFDECLINE,
  CONFINVITE = 0x18,
  CONFLOGOFF,
  CONFLOGON,
  CONFMSG,
  FILETRANSFER = 0x46,
  GAMELOGOFF,
  GAMELOGON = 0x28,
  GAMEMSG = 0x2a,
  GOTGROUPRENAME,     /* < 1, 36(old), 37(new) */
  GROUPRENAME = 0x89, /* > 1, 65(new), 66(0), 67(old) */
  IDACT,
  IDDEACT,
  IDLE,          /* 5 (placemarker) */
  IGNORECONTACT, /* > 1, 7, 13 < 1, 66, 13, 0*/
  ISAWAY,
  ISBACK,
  LIST,
  LOGOFF,
  LOGON = 1,
  MAILSTAT,
  MESSAGE,
  NEWCONTACT,
  NEWMAIL,
  NEWPERSONALMAIL,
  NOTIFY,
  P2PFILEXFER,
  PASSTHROUGH2 = 0x16,
  PEERTOPEER = 0x4F, /* Checks if P2P possible */
  PICTURE = 0xbe,
  PICTURE_CHECKSUM = 0xbd,
  PICTURE_UPDATE = 0xc1,
  PICTURE_UPLOAD = 0xc2,
  PING,
  REJECTCONTACT,
  REMBUDDY,
  STEALTH = 0xb9,
  SYSMESSAGE = 0x14,
  USERSTAT, /* 0xa */
  VERIFY,
  VOICECHAT = 0x4A,
  WEBCAM
};
};

/// Yahoo status
namespace YahooStatus {
enum Status {
  Available = 0,
  Away,
  Brb,
  Custom = 99,
  Disconnected = -1,
  Idle = 999,
  Invisible = 12,
  Notify = 0x16, /* TYPING */
  Occupied,
  Offline = 0x5a55aa56, /* don't ask */
  Onphone,
  OnVacation,
  OutToLunch,
  WEBLOGIN = 0x5a55aa55
};
};

/// Packet header
#define PACKETHRDLEN 20

typedef std::pair<int, std::string> MessagePair;

#endif
