/*
 * TestExceptions.h
 *
 *  Created on: 20 Sep 2014
 *      Author: alexgray
 */

#ifndef TESTEXCEPTIONS_H_
#define TESTEXCEPTIONS_H_

#include <string>
#include <stdexcept>
#include <fstream>
#include <iostream>

namespace TestFuncs {

class FileNotExistException {};
class FileNotReadableException {};

class FredException : public std::runtime_error {
public:
	FredException(std::string& str) : std::runtime_error(str) {}
};

class TestExceptions {
public:
	TestExceptions() throw();
	virtual ~TestExceptions();

	bool testFile(const std::string &) throw(FileNotExistException, FredException, FileNotReadableException);

};

} /* namespace TestFuncs */

#endif /* TESTEXCEPTIONS_H_ */
