.PHONY: clean

CC = g++

OBJ = \
	TestExceptions.o \
	baggins.o	\
	findExample.o	\
	testClass.o \
	testStatic.o \
	transformExample.o \
	TestOps.o	\
	dataClass.o \
	inheritTest.o	\
	sortExamples.o \
	testFuncs.o \
	threadExShrPtr.o

CFLAGS = -std=c++11

LIBS = libdemo.a
LDFLAGS = -lm -lncurses

%.o: %.cpp
	$(CC) -c $(CFLAGS) $< -o $@

libdemo.a: $(OBJ)
	ar rcs libdemo.a $(OBJ)

main: $(LIBS)
	$(CC) $(CFLAGS) $@.cpp $^ $(LDFLAGS) -o $@

all: main

clean:
	rm -f  main libdemo.a *.o