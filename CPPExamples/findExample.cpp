/*
 * findExample.cpp
 *
 *  Created on: 27 Feb 2017
 *      Author: alexgray
 */

#include <algorithm>

#include "findExample.h"

namespace findExamples
{
	// std 11
	bool if_all(std::set<int>& testSet, const int valx)
	{	if (testSet.empty())
			return false;

	return std::all_of(testSet.begin(),testSet.end(),
				[&valx](const int &e) -> bool { return e < valx; });
	}

	// std 98
	bool if_all(std::set<int>& testSet, const Tester &pred)
	{
		if (testSet.empty())
			return false;

		return std::all_of(testSet.begin(),testSet.end(),pred);
	}

	// std 11
	bool if_any(std::set<int>& testSet, const int valx)
	{	if (testSet.empty())
			return false;

		return std::any_of(testSet.begin(),testSet.end(),
				[&valx](const int &e) -> bool { return e < valx; });
	}

	// std 98
	bool if_any(std::set<int>& testSet, const Tester &pred)
	{
		if (testSet.empty())
			return false;

		return std::any_of(testSet.begin(),testSet.end(),pred);
	}
}



