/*
 * TestExceptions.cpp
 *
 *  Created on: 20 Sep 2014
 *      Author: alexgray
 */

#include "TestExceptions.h"
#include <sys/types.h>
#include <sys/stat.h>
#include <errno.h>

namespace TestFuncs {

TestExceptions::TestExceptions() throw() {
}

TestExceptions::~TestExceptions() {
}

bool
TestExceptions::testFile(const std::string &fileName) throw(FileNotExistException, FredException, FileNotReadableException) {
	struct stat fileStat = { 0 };
	if (fileName.empty()) {
		std::string str("Filename is empty");
		throw FredException(str);
	}
	if (stat(fileName.c_str(), &fileStat) < 0) {
		if (errno == ENOENT) {
			throw FileNotExistException();
		} else if (errno == EACCES) {
			throw FileNotReadableException();
		}
	}

	if (!(fileStat.st_mode & S_IRUSR)) {
		throw FileNotReadableException();
	}
	return true;
}

} /* namespace TestFuncs */
