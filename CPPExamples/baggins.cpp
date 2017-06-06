/*
 * baggins.cpp
 *
 *  Created on: 12 Jun 2016
 *      Author: alexgray
 */

#include "baggins.h"

namespace TestFuncs {

baggins::baggins() :
	uid_(0), seq_(0)
{
}

baggins::baggins(const char *a, const char *b) :
	uid_(0), seq_(0),
	id_(a), name_(b)
{
}

baggins::baggins(const std::string& a, const std::string& b) :
	uid_(0), seq_(0),
	id_(a), name_(b)
{
}

baggins::~baggins() {
}

baggins&
baggins::operator++ () {
	++seq_;
	return *this;
}

baggins
baggins::operator++ (int x) {
	baggins old = *this;
	++(*this);
	return old;
}

baggins&
baggins::operator= (const baggins &other)
{
	if (this == &other)
		return *this;

	uid_ = other.uid();
	seq_ = other.seq();
	name_ = other.name();
	id_ = other.id();

	return *this;
}

bool
baggins::operator== (const baggins &other)
{
	if (this == &other)
		return true;

	if (uid() == other.uid() && name() == other.name())
		return true;

	return false;
}

bool
baggins::operator!= (const baggins &other)
{
	return !(*this == other);
}

} /* namespace TestFuncs */
