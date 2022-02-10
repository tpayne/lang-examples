/*
 * transformExample.cpp
 *
 *  Created on: 27 Feb 2017
 *      Author: alexgray
 */

#include "transformExample.h"

namespace transformationExamples {
void transformSomething(const std::vector<std::string> &in,
                        std::vector<std::string> &out, Transformer &func) {
  if (in.empty())
    return;

  std::transform(in.begin(), in.end(), std::back_inserter(out), func);
  return;
}

void transformSomething(const std::vector<std::string> &in,
                        std::vector<std::string> &out,
                        const std::string &appendStr) {
  if (in.empty())
    return;

  std::transform(in.begin(), in.end(), std::back_inserter(out),
                 [&appendStr](const std::string &str) -> std::string {
                   return std::string(str + "->" + appendStr);
                 });

  return;
}
} // namespace transformationExamples
