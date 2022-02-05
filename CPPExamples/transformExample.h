/*
 * transformExample.h
 *
 *  Created on: 27 Feb 2017
 *      Author: alexgray
 */

#ifndef TRANSFORMEXAMPLE_H_
#define TRANSFORMEXAMPLE_H_

#include <algorithm>
#include <string>
#include <vector>

namespace transformationExamples {
class Transformer {
public:
  Transformer(std::string val) : str_(val) {}
  Transformer(const char *val) : str_(val) {}
  std::string &operator()(const std::string &val) {
    appended_ = val + "->" + str_;
    return appended_;
  }

private:
  std::string str_;
  std::string appended_;
};

void transformSomething(const std::vector<std::string> &,
                        std::vector<std::string> &, Transformer &);

void transformSomething(const std::vector<std::string> &,
                        std::vector<std::string> &, const std::string &);
} // namespace transformationExamples

#endif /* TRANSFORMEXAMPLE_H_ */
