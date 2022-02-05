/*
 * baggins.h
 *
 *  Created on: 12 Jun 2016
 *      Author: alexgray
 */

#ifndef BAGGINS_H_
#define BAGGINS_H_

#include <istream>
#include <string>

namespace TestFuncs {

class baggins {
public:
  baggins();
  baggins(int, int);
  baggins(const char *, const char *);
  baggins(const std::string &, const std::string &);
  virtual ~baggins();

  inline const std::string &id() const { return id_; }
  inline const std::string &name() const { return name_; }

  inline const int uid() const { return uid_; }
  inline const int seq() const { return seq_; }

  inline void name(const std::string &a) { name_ = a; }
  inline void name(const char *a) { name_ = a; }

  baggins &operator++();
  baggins operator++(int);

  baggins &operator=(const baggins &);

  bool operator==(const baggins &);
  bool operator!=(const baggins &);

private:
  int uid_;
  int seq_;

  std::string id_;
  std::string name_;
};

} /* namespace TestFuncs */

#endif /* BAGGINS_H_ */
