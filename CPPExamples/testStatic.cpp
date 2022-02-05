/*
 * testStatic.cpp
 *
 *  Created on: 20 Sep 2014
 *      Author: alexgray
 */

#include "testStatic.h"

namespace TestFuncs {

testStatic::testStatic() : iVar(0), iVar2(0) {}
testStatic::testStatic(int a, int b) : iVar(a), iVar2(b) {}

testStatic testStatic::createTest(int a, int b) { return testStatic(a, b); }

testStatic testStatic::cloneTest(const testStatic &other) {
  return testStatic(other.iVar, other.iVar2);
}

testStatic::~testStatic() {}

} /* namespace TestFuncs */
