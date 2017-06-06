#include <iostream>
#include <cstdlib>
#include <algorithm>
#include <vector>
#include <set>
#include <ostream>


#include "testClass.h"
#include "testFuncs.h"
#include "inheritTest.h"
#include "dataClass.h"
#include "TestExceptions.h"
#include "testStatic.h"
#include "TestOps.h"
#include "findExample.h"
#include "transformExample.h"
#include "sortExamples.h"
#include "threadExShrPtr.h"

namespace {

	class Dataoid{
	public:
		Dataoid(int a) : i_(a) {}
		int operator()() { ++i_; return i_; }
	private:
		int i_;
	};

	class Functionoid {
	public:
		Functionoid(int a=1) : ivar(a) {}
		int operator()() { ++ivar; return ivar; }
	private:
		int ivar;
	};

	class Data {
	public:
		Data() : data("Test") {}
		virtual ~Data() {}
		friend void setData(const std::string &, Data &);
		friend std::ostream& operator<< (std::ostream&, Data &);
	private:
		std::string data;
	};

	std::ostream& operator<< (std::ostream& stream, Data& a) {
		return stream << a.data;
	}

	void setData(const std::string &data, Data& a) {
		a.data = data;
		return;
	}

	void testFriend() {
		Data a;
		std::string str("This is a string");
		setData(str, a);
		std::cout << "This is a ->" << a << std::endl;
		return;
	}

	void testFuncs() {
		Functionoid aseq(10);
		std::cout << "\nSeq " << aseq();
		for(int i=0;i<100;++i) {
			std::cout << "\nSeq " << aseq();
		}
		return;
	}

	struct testStruct {
		int iVar;
		int iJ;
		const char* pcData;
		const char* pcLstr;
		std::string str;
	};

	void insertsClassIntoVector() {
		std::vector< struct testStruct > testStructs;
		struct testStruct test = { 0 };

		for(int i=0;i<200;++i) {
			test.iVar = i;
			testStructs.push_back(test);
		}

		std::vector< struct testStruct >::const_iterator it(testStructs.begin());
		for(;it!=testStructs.end();++it) {
			std::cout << "\n" << "The value of i = " << (*it).iVar << std::endl;
		}
		return;
	}

	bool testCondition(testClass test) {
		return(test.iUid() > 500);
	}


	void insertsClassIntoSet() {
		std::set< testClass > testClassesSet;
		std::set< testClass > testClassesSet2;
		std::set< testClass > testClassesSet3;

		testClass testme;

		{
			for(int i=0;i<200;++i) {
				testClass testmex;
				testme.iUid(i);
				testme.iClass(i);
				testme.iObjUid(i);
				testClassesSet.insert(testme);
				testmex = testme;
				testmex += testme;
				testClassesSet.insert(testme);
			}
		}

		{
			for(int i=0;i<2000;++i) {
				testme.iUid(i);
				testme.iClass(i);
				testme.iObjUid(i);
				testClassesSet2.insert(testme);
			}
		}

		std::set< testClass >::const_iterator it(testClassesSet.begin());
		for(;it!=testClassesSet.end();++it) {
			std::cout << "\n" << "The value of iUid1 = " << (*it).iUid() << std::endl;
		}

		std::set< testClass >::const_iterator it1(testClassesSet2.begin());
		for(;it1!=testClassesSet2.end();++it1) {
			std::cout << "\n" << "The value of iUid2 = " << (*it1).iUid() << std::endl;
		}

		std::set_difference(testClassesSet2.begin(),testClassesSet2.end(),
				testClassesSet.begin(),testClassesSet.end(),
				std::inserter(testClassesSet3,testClassesSet3.begin()));

		for(std::set< testClass >::const_iterator it1=testClassesSet3.begin();
			it1!=testClassesSet3.end(); ++it1) {
			std::cout << "The diff set has iUid() = " << (*it1).iUid() << std::endl;
		}

		for(std::set< testClass >::const_iterator it2=std::find_if(testClassesSet3.begin(), testClassesSet3.end(), testCondition);
			it2!=testClassesSet3.end(); ++it2) {
			std::cout << "The diff set test has iUid() = " << (*it2).iUid() << std::endl;
		}

		return;
	}

	void testDataSet() {
		TestFuncs::DataSet	data;

		data.addUser("User1");
		data.addUser("User2");
		data.addUser("User3");

		std::vector<std::string>::const_iterator a(data.userList().begin());
		for(;a!=data.userList().end();++a) {
			std::cout << "User = " << (*a) << std::endl;
		}

		for(const auto& s : data.userList()) {
			std::cout << "User = " << s << std::endl;
		}

		data.deleteUser("User2");
		a = data.userList().begin();

		for(;a!=data.userList().end();++a) {
			std::cout << "User = " << (*a) << std::endl;
		}

	}

	void insertHistory() {

		TestFuncs::testFuncs changeSet;

		changeSet.iUid(10);
		changeSet.name("test10");

		for(int i=0; i<2000; ++i) {
			TestFuncs::history histRec;
			std::string str;

			histRec.histUid(i);
			histRec.date(time(0)+i);
			str = "author";
			histRec.author(str);
			str = "comment";
			histRec.comment(str);
			changeSet.addHistory(histRec);
		}

		std::vector< TestFuncs::history >::const_iterator it(changeSet.getHistory().begin());
		for(;it!=changeSet.getHistory().end(); ++it) {
			std::cout << "History " << (*it).date() << " " << (*it).author() << " " << (*it).comment() << std::endl;
		}
	}

	void inheritTest() throw(std::bad_alloc) {
		TestFuncs::inheritChild *test = new TestFuncs::inheritChild();
		TestFuncs::inheritChild *testPtr = new TestFuncs::inheritChild[10];

		test->str(std::string("test"));
		test->iUid(10);
		delete test;
		delete[] testPtr;
		return;
	}

	void staticTest() {

		TestFuncs::dataClass test;
		TestFuncs::dataClass test1;
		test.iUid(0);
		test1.iUid(-10);
		std::cout << "Number of dataClasses = " << TestFuncs::dataClass::num() << std::endl;
	}

	template<class T>
	void swap(T &a, T &b) {
		T x = a;
		a = b;
		b = x;
		return;
	}

	void swap(int &a, int &b) {
		int x = a;
		a = b;
		b = x;
		return;
	}

	void testEmptyFile() {
		try {
			std::string dd;
			TestFuncs::TestExceptions testme;
			if (testme.testFile(dd)) {
				std::cout << "Filename is ok" << std::endl;
				return;
			}
		} catch(TestFuncs::FredException& e) {
			std::cerr << e.what() << std::endl;
			return;
		}
	}
	void testFile() {
		std::string fileName("/tmp/file.txt");
		try {
			TestFuncs::TestExceptions testme;
			if (testme.testFile(fileName)) {
				std::cout << "Filename is ok" << std::endl;
				return;
			}
		} catch(TestFuncs::FileNotExistException& e) {
			std::cerr << "File does not exist!" << std::endl;
			return;
		} catch(TestFuncs::FileNotReadableException& e) {
			std::cerr << "File is not readable!" << std::endl;
			return;
		} catch(...) {
			std::cerr << "Unknown exception" << std::endl;
			return;
		}
	}

	void testStatic() {
		TestFuncs::testStatic obj = TestFuncs::testStatic::createTest(1,2);
		TestFuncs::testStatic obj1 = TestFuncs::testStatic::cloneTest(obj);
		return;
	}

	void testOps() {
		TestFuncs::TestOps tt;
		std::cout << "Tt = " << tt;
		++tt;
		std::cout << "Tt = " << tt;
		tt++;
		std::cout << "Tt = " << tt;

		TestFuncs::TestOps tt1(tt);
		TestFuncs::TestOps tt2;

		tt2 = tt1;
		++tt2;
		std::cout << "Tt1 = " << tt1;
		std::cout << "Tt2 = " << tt2;

		return;
	}

	// std 98 + c11
	void testFindExamples98() {
		int test(10);
		int limit(20);
		findExamples::Tester pred(test);

		std::set<int> testSet;

		for(int i=0;i<limit;++i)
			testSet.insert(i);

		std::cout << "If all returned " << findExamples::if_all(testSet,pred) << std::endl;
		std::cout << "If any returned " << findExamples::if_any(testSet,pred) << std::endl;

		std::cout << "If all returned " << findExamples::if_all(testSet,test) << std::endl;
		std::cout << "If any returned " << findExamples::if_any(testSet,test) << std::endl;

		return;
	}

	// std 98 + c11
	void testTransformExamples() {
		transformationExamples::Transformer pred("Hello");

		std::vector<std::string> inVec;
		std::vector<std::string> outVec;

		for(int i=0;i<100;++i)
			inVec.push_back("This is a string");

		// c++ 98
		transformationExamples::transformSomething(inVec,outVec,pred);
		for(std::vector<std::string>::const_iterator it(outVec.begin());
			it != outVec.end();++it) {
			std::cout << "OutVec: " << *it << std::endl;
		}

		outVec.clear();

		// c++ 11
		transformationExamples::transformSomething(inVec,outVec,"Test");
		for(const auto& s : outVec) {
			std::cout << "OutVec: " << s << std::endl;
		}

		return;
	}

	void testSortExamples() {

		std::vector<int> noVec;
		std::vector<int> noVec1;
		std::vector<int> noVec2 = { 1,2,3,4,5,6,7,8,9,10,2 }; //c++11 only
		std::vector<std::string> strVec;
		std::vector<std::string> strVec1 = { "be afraid", "hello", "hello1", "hello2" }; //c++11 only

		for(int i=0;i<100;++i) {
			noVec.push_back(i);
			noVec1.push_back(i);
			strVec.push_back(std::string("Hello")+std::to_string(i));
		}

		std::cout << "Are sorted? " << sortExamples::isSorted(noVec) << std::endl;
		std::cout << "Are sorted? " << sortExamples::isSorted(strVec) << std::endl;
		std::cout << "Are sorted? " << sortExamples::isSorted(noVec2) << std::endl;
		std::cout << "Are sorted? " << sortExamples::isSorted(strVec1) << std::endl;

		std::reverse(noVec.begin(), noVec.end());
		std::reverse(strVec.begin(), strVec.end());

		std::cout << "Are sorted reversed? " << sortExamples::isSorted(noVec) << std::endl;
		std::cout << "Are sorted reversed? " << sortExamples::isSorted(strVec) << std::endl;

		noVec.clear();
		noVec.push_back(1);
		noVec.push_back(2);
		noVec.push_back(3);
		noVec.push_back(6);
		noVec.push_back(4);
		noVec.push_back(10);
		noVec.push_back(7);

		int last(0);
		int until(0);
		(void)sortExamples::isSorted(noVec,last,until);
		std::cout << "Are partially sorted? " << last << ":" << until << std::endl;

		noVec.clear();
		for(int i=0;i<50;++i) {
			noVec.push_back(i);
		}

		std::cout << "Are partially alike? " << sortExamples::isAlike(noVec1,noVec1) << std::endl;
		std::cout << "Are partially alike? " << sortExamples::isAlike(noVec1,noVec) << std::endl;
		std::cout << "Are partially alike? " << sortExamples::isAlike(noVec,noVec1) << std::endl;

		return;
	}
}

int TestFuncs::dataClass::num_ = 0;

int main(const int argc, const char **argv) {
	std::cout << "This is a test program" << std::endl;
	insertsClassIntoVector();
	insertsClassIntoSet();
	insertHistory();
	inheritTest();
	staticTest();
	testFile();
	testEmptyFile();
	testStatic();
	testFuncs();
	testFriend();
	testOps();
	testFindExamples98();
	testTransformExamples();
	testSortExamples();
	testDataSet();
	threadExShrPtr::threadShow();
	uniqueExPtr::useUniquePtr();

	std::cout << std::flush;
	std::cerr << std::flush;

	int a(1);
	int b(2);
	std::cout << "\na = " << a;
	std::cout << "\nb = " << b;
	swap(a,b);
	std::cout << "\na = " << a;
	std::cout << "\nb = " << b;

	{
		int source[5]={0,12,34,50,80};
		int target[5];
		//copy 5 elements from source to target
		std::copy_n(source,5,target);

		std::cout << "\nsource = " << source;
		std::cout << "\ntarget = " << target;
	}

	std::string data("Test");
	std::string data1("Test1");
	swap(data,data1);
	std::cout << "\ndata = " << data;
	std::cout << "\ndata1 = " << data1;
	return EXIT_SUCCESS;
}
