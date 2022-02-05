/*
 * sortExamples.h
 *
 *  Created on: 27 Feb 2017
 *      Author: alexgray
 */

#ifndef SORTEXAMPLES_H_
#define SORTEXAMPLES_H_

#include <algorithm>
#include <string>
#include <vector>

namespace sortExamples {

bool isSorted(const std::vector<int> &);
bool isSorted(const std::vector<std::string> &);
bool isSorted(const std::vector<int> &, int &, int &);
bool isAlike(const std::vector<int> &, const std::vector<int> &);
} // namespace sortExamples

#endif /* SORTEXAMPLES_H_ */
