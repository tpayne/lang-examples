/*
 * findExample.h
 *
 *  Created on: 27 Feb 2017
 *      Author: alexgray
 */

#ifndef FINDEXAMPLE_H_
#define FINDEXAMPLE_H_

#include <set>

namespace findExamples
{
	class Tester
	{
	public:
		Tester(int val) : tester_(val) {}
		bool operator() (const int& val)
		{
			return val < tester_;
		}
	private:
		int tester_;
	};

	bool if_all(std::set<int>&, const Tester &);
	bool if_any(std::set<int>&, const Tester &);

	bool if_all(std::set<int>&, int);
	bool if_any(std::set<int>&, int);
}



#endif /* FINDEXAMPLE_H_ */
