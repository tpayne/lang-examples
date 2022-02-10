///
///   locale.cpp
///   MessengerUtils
///   Created by Tim Payne on 25/08/2008.
///   Copyright 2008 __MyCompanyName__. All rights reserved.
///
/// @file

#include "Msnlocale.h"
#include "UtilityFuncs.h"

/// \namespace Msnlocale
/// Locale functions for MSN
namespace Msnlocale {
struct LangElems {
  const char *code;
  const char *language;
  unsigned int lcihex;
  int lcidec;
  int ansicode;
};

static struct LangElems LangCodes[] = {
    ///
    /// Note - this table is not complete. Language variants are not covered
    ///
    /// ShortCode, Language, LCIDHEX, LCIDDEC, ANSICODEPG
    ///
    {"ar", "Arabic", 0x0401, 1025, 1256},
    {"bg", "Bulgarian", 0x0402, 1026, 1251},
    {"zh", "Chinese (PRC)", 0x0804, 2052, 936},
    {"zh_HK", "Chinese (Hong Kong SAR)", 0x0C04, 3076, 950},
    {"zh_TW", "Chinese (Taiwan)", 0x0404, 1028, 950},
    {"hr", "Croatian (Latin)", 0x101A, 4122, 1250},
    {"cs", "Czech", 0x0405, 1029, 1250},
    {"da", "Danish", 0x0406, 1030, 1252},
    {"nl", "Dutch", 0x0413, 1043, 1252},
    {"en", "English", 0x0409, 1033, 1252},
    {"et", "Estonian", 0x0425, 1061, 1257},
    {"fi", "Finnish", 0x040B, 1035, 1252},
    {"fr", "French", 0x040C, 1036, 1252},
    {"de", "German", 0x0407, 1031, 1252},
    {"el", "Greek", 0x0408, 1032, 1253},
    {"he", "Hebrew", 0x040D, 1037, 1255},
    {"hu", "Hungarian", 0x040E, 1038, 1250},
    {"it", "Italian", 0x0410, 1040, 1252},
    {"ja", "Japanese", 0x0411, 1041, 932},
    {"ko", "Korean", 0x0412, 1042, 949},
    {"lv", "Latvian", 0x0426, 1062, 1257},
    {"lt", "Lithuanian", 0x0427, 1063, 1257},
    {"no", "Norwegian (Bokmål)", 0x0414, 1044, 1252},
    {"pl", "Polish", 0x0415, 1045, 1250},
    {"pt", "Portuguese(Portugal)", 0x0816, 2070, 1252},
    {"ro", "Romanian", 0x0418, 1048, 1250},
    {"ru", "Russian", 0x0419, 1049, 1251},
    {"sr", "Serbian(Latin)", 0x081A, 2074, 1250},
    {"sk", "Slovak", 0x041B, 1051, 1250},
    {"sl", "Slovenian", 0x0424, 1060, 1250},
    {"es", "Spanish (International Sort)", 0x0C0A, 3082, 1252},
    {"sv", "Swedish", 0x041D, 1053, 1252},
    {"th", "Thai", 0x041E, 1054, 874},
    {"tr", "Turkish", 0x041F, 1055, 1254},
    {"uk", "Ukrainian", 0x0422, 1058, 1251},
    {0, 0, 0, 0, 0}};

///
//----------------------------------------------------------------------------
//   FUNCTION SPECIFICATION
//   Name:
///   GetLocaleCode
//   Description:
///  \brief  Get locale code from known locales
//   Parameters:
///   @param const char*
//   Return:
///   @return unsigned int
//   Notes:
//----------------------------------------------------------------------------
///
unsigned int GetLocaleCode(const char *locale) {
  int x = 0;
  while (LangCodes[x].code != 0) {
    if (!strcasecmp(LangCodes[x].code, locale))
      return LangCodes[x].lcihex;
    x++;
  }
  return 0;
}
} // namespace Msnlocale
