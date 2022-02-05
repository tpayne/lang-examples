/*
 * TestOps.cpp
 *
 *  Created on: 20 Sep 2014
 *      Author: alexgray
 */

#include "TestOps.h"

namespace TestFuncs {

TestOps::TestOps(const TestOps &p) : x(p.x) {}

TestOps &TestOps::operator=(const TestOps &p) {
  if (this == &p)
    return *this;

  x = p.x;
  return *this;
}

TestOps &TestOps::operator++() {
  x++;
  return *this;
}

TestOps TestOps::operator++(int) {
  TestOps old = *this;
  ++(*this);
  return old;
}

std::ostream &operator<<(std::ostream &stream, const TestOps s) {
  stream << s.x << std::endl;
  return stream;
}

} /* namespace TestFuncs */
