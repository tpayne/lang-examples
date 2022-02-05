/*
 * testClass.cpp
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#include "testClass.h"

testClass::testClass() : iUid_(0), iClass_(0), iObjUid_(0) {}

testClass::~testClass() {
  // TODO Auto-generated destructor stub
}

inline bool testClass::operator>(const testClass &other) const {
  if (iUid() > other.iUid() && iClass() > other.iClass() &&
      iObjUid() > other.iObjUid())
    return true;

  return false;
}

testClass &testClass::operator+=(const testClass &other) {
  iUid(iUid() + other.iUid());
  iClass(iClass() + other.iClass());
  iObjUid(iObjUid() + other.iObjUid());
  str(str() + " " + other.str());
  sDate(sDate() + " " + other.sDate());
  return *this;
}

bool testClass::operator<(const testClass &other) const {
  if (iUid() < other.iUid() && iClass() < other.iClass() &&
      iObjUid() < other.iObjUid())
    return true;

  return false;
}

inline bool testClass::operator==(const testClass &other) const {
  if (iUid() == other.iUid() && iClass() == other.iClass() &&
      iObjUid() == other.iObjUid())
    return true;

  return false;
}

inline bool testClass::operator!=(const testClass &other) const {
  return (this != &other);
}
