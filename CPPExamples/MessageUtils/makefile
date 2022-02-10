#
# Simple makefile for MessagerUtils
#
BLDTARGET := $(PLATFORM)_$(TARGET)

ifeq ($(TARGET), debug)
DEBUG := 1
endif

# Include the platform specific dependencies...
include platform/$(PLATFORM).mk

#
# What dependencies do I have?
#

# Messenger Utility...

MSGOBJLIST := \
	$(BLDTARGET)/Threads.$(OBJSUF) \
	$(BLDTARGET)/Mutex.$(OBJSUF) \
	$(BLDTARGET)/UtilityFuncs.$(OBJSUF) \
	$(BLDTARGET)/MessengerApps.$(OBJSUF) \
	$(BLDTARGET)/Msn.$(OBJSUF) \
	$(BLDTARGET)/MsnMsg.$(OBJSUF) \
	$(BLDTARGET)/Yahoo.$(OBJSUF) \
	$(BLDTARGET)/YahooMsg.$(OBJSUF) \
	$(BLDTARGET)/ChatSessions.$(OBJSUF) \
	$(BLDTARGET)/MsnChatSessions.$(OBJSUF) \
	$(BLDTARGET)/NetworkOps.$(OBJSUF) \
	$(BLDTARGET)/NetworkOpsSSL.$(OBJSUF) \
	$(BLDTARGET)/Msnlocale.$(OBJSUF) \
	$(BLDTARGET)/FileTransferRequests.$(OBJSUF) \
	$(BLDTARGET)/messappcmd.$(OBJSUF)

MSGEXELIST := \
	$(BLDTARGET)/MessengerUtils$(EXESUF)

$(BLDTARGET)/MessengerUtils$(EXESUF) : $(MSGOBJLIST)

EXELIST := \
	$(MSGEXELIST)

setup::
	@-mkdir $(BLDTARGET)

clean::
	@echo Cleaning up...
	@-rm -fr $(BLDTARGET)

all:: setup $(EXELIST)
	@echo Building target $(TARGET) for $(PLATFORM)...
