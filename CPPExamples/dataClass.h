/*
 * dataClass.h
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#ifndef DATACLASS_H_
#define DATACLASS_H_

namespace TestFuncs {

class DelegateConstr {
public:
  DelegateConstr(int i) : i_(i), p_(0) {}
  DelegateConstr() : DelegateConstr(0) {}
  virtual ~DelegateConstr() {}

private:
  int i_;
  const char *p_;
};

class dataClass {
public:
  dataClass();
  virtual ~dataClass();

  inline int iUid() const { return iUid_; }
  inline void iUid(int i) { iUid_ = i; }
  inline int iClass() const { return iClass_; }
  inline void iClass(int i) { iClass_ = i; }

  static int num() { return num_; }
  static int num_;

private:
  int iUid_;
  int iClass_;
};

} /* namespace TestFuncs */

#endif /* DATACLASS_H_ */
