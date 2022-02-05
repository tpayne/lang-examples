/*
 * testStatic.h
 *
 *  Created on: 20 Sep 2014
 *      Author: alexgray
 */

#ifndef TESTSTATIC_H_
#define TESTSTATIC_H_

namespace TestFuncs {

class testStatic {
public:
  virtual ~testStatic();
  static testStatic createTest(int, int);
  static testStatic cloneTest(const testStatic &);

private:
  int iVar;
  int iVar2;
  testStatic();
  testStatic(int, int);
};

} /* namespace TestFuncs */

#endif /* TESTSTATIC_H_ */
