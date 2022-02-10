/*
 * sortExamples.cpp
 *
 *  Created on: 27 Feb 2017
 *      Author: alexgray
 */

#include "sortExamples.h"

namespace sortExamples {

bool isSorted(const std::vector<int> &in) {
  if (in.empty())
    return false;

  return std::is_sorted(in.begin(), in.end());
}

bool isSorted(const std::vector<int> &in, int &last, int &until) {
  if (in.empty())
    return false;

  auto sortedUntil = std::is_sorted_until(in.begin(), in.end());
  until = (int)std::distance(in.begin(), sortedUntil);
  last = (int)*(sortedUntil - 1);
  return true;
}

bool isSorted(const std::vector<std::string> &in) {
  if (in.empty())
    return false;

  auto smaller_length = [](std::string const &first,
                           std::string const &second) {
    return first.length() < second.length();
  };

  return std::is_sorted(in.begin(), in.end(), smaller_length);
}

bool isAlike(const std::vector<int> &in1, const std::vector<int> &in2) {
  if (in1.empty() || in2.empty())
    return false;

  return std::is_permutation(in1.begin(), in1.end(), in2.begin());
}

bool testNull(const char *p) {
  if (p == nullptr) { // c++11 null ptr support (auto works with any)
    return false;
  }
  return true;
}
} // namespace sortExamples
