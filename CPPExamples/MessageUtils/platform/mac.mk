#
# Linux Mac x86 Makefile
#
# Build rules...
.SUFFIXES: .a .o .c .cpp .h

OBJSUF 		= 	o
EXESUF 		= 	
SHLIBSUF	=  	sl
LIBSUF		=   a

# 3rd party dependencies...
APPSDIR := ./

OPENSSL_DIR  := /usr/local/opt/openssl/
OPENSSL_LIB  := -L$(OPENSSL_DIR)/lib/ -lcrypto -lssl

LIBS    =   \
			-lm -lncurses -lpthread \
			$(OPENSSL_LIB)

INCLUDES =  \
		-I$(OPENSSL_DIR)/include/

CFLAGS = \
		-std=c++11 -Wall -DUNIX -DMAC -Dunix -Wno-deprecated-declarations \
		-fpermissive -Wno-deprecated $(INCLUDES)


ifdef DEBUG
CFLAGS += -g3
endif

CXXFLAGS = $(CFLAGS)

STRIP  =
LD     =	g++
LDSHARED =  
LDPROG =    
LDFLAGS =	-Wno-deprecated-declarations -fpermissive -Wno-deprecated
CC		=	g++
CXX		=	$(CC)

# Dependency rules
$(BLDTARGET)/%.$(OBJSUF) : %.c
	@-rm -f "$@"
	$(CC) -c $(CFLAGS) -o "$@" "$<"

$(BLDTARGET)/%.$(OBJSUF) : %.cpp
	@-rm -f "$@"
	$(CXX) -c $(CXXFLAGS) -o "$@" "$<"

$(BLDTARGET)/%$(EXESUF) : $^
	$(LD) $(LDPROG) $(LDFLAGS) $(LIBS) -o "$@" $^

