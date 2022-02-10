/*
 * testClass.h
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#ifndef TESTCLASS_H_
#define TESTCLASS_H_

#include <iostream>
#include <string>

class testClass {
public:
  testClass();
  virtual ~testClass();

  // class testData {
  //	testData() = default; // default constructors
  //	virtual testData() = default;
  //	testData & operator =( const testData & ) = delete; // disable copy
  //function - delete it 	testData ( const testData & ) = delete;
  // };

  inline void iUid(int i) { iUid_ = i; }
  inline int iUid() const { return iUid_; }
  inline void iClass(int i) { iClass_ = i; }
  inline int iClass() const { return iClass_; }
  inline void iObjUid(int i) { iObjUid_ = i; }
  inline int iObjUid() const { return iObjUid_; }

  inline void str(const std::string &str) { str_ = str; }
  inline const std::string &str() const { return str_; }
  inline void sDate(const std::string &str) { sDate_ = str; }
  inline const std::string &sDate() const { return sDate_; }

  bool operator<(const testClass &other) const;
  inline bool operator>(const testClass &other) const;
  inline bool operator==(const testClass &other) const;
  inline bool operator!=(const testClass &other) const;
  testClass &operator+=(const testClass &other);

private:
  int iUid_;
  int iClass_;
  int iObjUid_;
  std::string str_;
  std::string sDate_;
};

#endif /* TESTCLASS_H_ */
