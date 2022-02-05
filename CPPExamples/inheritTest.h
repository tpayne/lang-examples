/*
 * inheritTest.h
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#ifndef INHERITTEST_H_
#define INHERITTEST_H_

#include <set>
#include <string>

namespace TestFuncs {

class inheritTestABC {
public:
  inheritTestABC(){};
  virtual ~inheritTestABC(){};
  virtual inheritTestABC *clone() const = 0; // virtual copy idiom
  virtual const std::string &str() const = 0;
  virtual void str(const std::string &str) = 0;
  virtual int iUid() const = 0;
  virtual void iUid(int iUid) = 0;
};

class inheritBase : public inheritTestABC {
public:
  inheritBase();
  virtual ~inheritBase(){};

  virtual inheritBase *clone() const;
  virtual const std::string &str() const { return str_; }
  virtual void str(const std::string &str) { str_ = str; }
  virtual int iUid() const { return iUid_; }
  virtual void iUid(int iUid) { iUid_ = iUid; }

protected:
  int iUid_;
  std::string str_;
};

class inheritChild : public inheritBase {
public:
  inheritChild();
  virtual ~inheritChild(){};

  virtual const std::string &str() const;
  virtual void str(const std::string &str);

  virtual inheritChild *clone() const;

  inline int iClass() const { return iClass_; }
  inline void iClass(int iClass) { iClass_ = iClass; }

private:
  int iClass_;
};

class Sword {
public:
  Sword() : p_(0) {}
  Sword(inheritTestABC *p) : p_(p) {}
  virtual ~Sword() {
    if (p_)
      delete (p_);
  }
  Sword(const Sword &f) : p_(f.p_->clone()) {}
  Sword &operator=(const Sword &f) {
    if (this != &f) {
      inheritTestABC *p2 = f.p_->clone();
      delete p_;
      p_ = p2;
    }
    return *this;
  }

private:
  inheritTestABC *p_;
};

} /* namespace TestFuncs */

#endif /* INHERITTEST_H_ */
