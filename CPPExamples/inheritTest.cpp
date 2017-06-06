/*
 * inheritTest.cpp
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#include "inheritTest.h"

namespace TestFuncs {

inheritBase::inheritBase() :
		iUid_(0) {
}

inheritBase*
inheritBase::clone() const {
	return new inheritBase(*this);
}

inheritChild::inheritChild() :
		inheritBase(), iClass_(0) {
}

const std::string&
inheritChild::str() const {
	return str_;
}

void
inheritChild::str(const std::string& str) {
	std::string strl(inheritBase::str());
	strl += "l";
	str_ = strl;
}

inheritChild*
inheritChild::clone() const {
	return new inheritChild(*this);
}

} /* namespace TestFuncs */

