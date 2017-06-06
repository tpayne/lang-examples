/*
 * testFuncs.h
 *
 *  Created on: 19 Sep 2014
 *      Author: alexgray
 */

#ifndef TESTFUNCS_H_
#define TESTFUNCS_H_

#include <vector>
#include <string>
#include <set>
#include <algorithm>

namespace TestFuncs {

	class DataSet {
	public:
		DataSet();
		DataSet(const std::string, const std::vector<std::string>);
		virtual ~DataSet();

		inline const std::string& name(void) const { return name_; }
		inline void name(const std::string a) { name_ = a; }
		inline void name(const char* a) { name_ = a; }

		inline const std::vector<std::string>& userList(void) const { return userList_; }
		inline void userList(const std::vector<std::string> a) { userList_ = a; }

		inline void addUser(const std::string a) { userList_.push_back(a); }
		void deleteUser(const std::string);
	private:
		std::string name_;
		std::vector<std::string> userList_;
	};

	class history {
	public:
		history();
		virtual ~history();

		inline int histUid() const { return histUid_; }
		inline void histUid(int i) { histUid_ = i; }
		inline time_t date() const { return date_; }
		inline void date(time_t date) { date_ = date; }

		inline const std::string& author() const { return author_; }
		inline void author(std::string& author) { author_ = author; }
		inline const std::string& comment() const { return comment_; }
		inline void comment(std::string comment) { comment_ = comment; }

	private:
		int histUid_;
		time_t date_;
		std::string author_;
		std::string comment_;
	};

	class testFuncs {
	public:
		testFuncs();
		virtual ~testFuncs();

		inline int iUid() const { return iUid_; }
		inline void iUid(int iUid) { iUid_ = iUid; }
		inline const std::string& name() const { return sName_; }
		inline void name(std::string& name) { sName_ = name; }
		inline void name(const char *name) { sName_ = name; }
		inline void addHistory(history hist) { hist_.push_back(hist); }
		inline const std::vector< history >& getHistory() { return hist_; }

	private:
		int iUid_;
		std::string sName_;

		std::vector< history > hist_;
	};

} /* namespace TestFuncs */

#endif /* TESTFUNCS_H_ */
