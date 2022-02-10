#
# Windows Win32 x86 Makefile
#
.SUFFIXES:

OBJSUF 		= 	obj
EXESUF 		= 	.exe
SHLIBSUF	=  	dll
LIBSUF		=   lib

# 3rd party dependencies...
APPSDIR := C:\Work\Builds\Mars
#APPSDIR := d:\users\timp\work\build_areas\mars
OPENSSL_DIR  := $(APPSDIR)/openssl/openssl-0.9.8-VC8-VS.NET2005/openssl-0.9.8h.vc8
OPENSSL_LIB  := "$(OPENSSL_DIR)/out32dll/libeay32.$(LIBSUF)" \
                "$(OPENSSL_DIR)/out32dll/ssleay32.$(LIBSUF)" \

# Build rules...
.SUFFIXES: .lib .obj .c .cpp .h



LIBS    =   \
			kernel32.lib user32.lib gdi32.lib winspool.lib \
			comdlg32.lib advapi32.lib shell32.lib ole32.lib \
			oleaut32.lib uuid.lib odbc32.lib odbccp32.lib \
			Ws2_32.lib $(OPENSSL_LIB)

INCLUDES =  \
		/I"$(VCINSTALLDIR)/include" \
		/I"$(OPENSSL_DIR)/inc32"

CFLAGS = \
		/MD /Zi /Od /D "WIN32" /D "_CONSOLE" \
        /D "x86" /D "_WIN32" \
        /D "STRICT" /D "_CRT_SECURE_NO_WARNINGS" \
		/nologo /Gm- /EHac /W3 /WX /Gy /GF /Zc:forScope \
		-wd4995 -wd4100 -wd4127 -wd4244 \
		/c $(INCLUDES)

ifdef DEBUG
CFLAGS += /D "DEBUG"
endif

CXXFLAGS = $(CFLAGS)

STRIP  =
LD     =    link
LDSHARED =  /dll /incremental:no /nologo
LDPROG =    /nologo /subsystem:console /incremental:no /map /machine:I386 /debug
LDFLAGS =
CC		=	CL
CXX		= 	$(CC)

# Dependency rules
$(BLDTARGET)/%.$(OBJSUF) : %.c
	@-rm -f "$@"
	$(CC) /c $(CFLAGS) /Fd"$(TARGET)/$*.pdb" /Fo"$@" "$<"

$(BLDTARGET)/%.$(OBJSUF) : %.cpp
	@-rm -f "$@"
    $(CXX) /c $(CXXFLAGS) /Fo"$@" "$<"

$(BLDTARGET)/%$(EXESUF) : $^
    $(LD) $(LDPROG) $(LIBS) /out:"$@" $^

