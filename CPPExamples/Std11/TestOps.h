/*
 * TestOps.h
 *
 *  Created on: 20 Sep 2014
 *      Author: alexgray
 */

#ifndef TESTOPS_H_
#define TESTOPS_H_

#include <ostream>

namespace TestFuncs {

class TestOps {
public:
  TestOps(int xx = 1) : x(xx) {}
  TestOps(const TestOps &);
  virtual ~TestOps() {}

  TestOps &operator++();   // pre-increment ++a
  TestOps operator++(int); // post-increment a++
  TestOps &operator=(const TestOps &);

  friend std::ostream &operator<<(std::ostream &, const TestOps);

private:
  int x;
};

} /* namespace TestFuncs */

#endif /* TESTOPS_H_ */
