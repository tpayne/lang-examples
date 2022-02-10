/*
 * dataClass.cpp
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#include "dataClass.h"

namespace TestFuncs {

dataClass::dataClass() : iUid_(0), iClass_(0) {
  // TODO Auto-generated constructor stub
  num_++;
}

dataClass::~dataClass() {
  // TODO Auto-generated destructor stub
  num_--;
}

} /* namespace TestFuncs */
