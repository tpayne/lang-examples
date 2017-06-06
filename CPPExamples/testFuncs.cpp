/*
 * testFuncs.cpp
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#include "testFuncs.h"

namespace TestFuncs {

history::history() : histUid_(0), date_(0) {

}

history::~history() {

}

DataSet::DataSet() {
}

DataSet::DataSet(const std::string a, const std::vector<std::string> b) {
	name(a);
	userList(b);
}

DataSet::~DataSet() {
}

void DataSet::deleteUser(const std::string aName) {
	std::vector<std::string>::const_iterator a;
	a = std::find(userList_.begin(),userList_.end(),aName);
	if (a != userList_.end())
		userList_.erase(a);
	return;
}

testFuncs::testFuncs() : iUid_(0) {
	// TODO Auto-generated constructor stub

}

testFuncs::~testFuncs() {
	// TODO Auto-generated destructor stub
}


} /* namespace TestFuncs */
