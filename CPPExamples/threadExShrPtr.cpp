/*
 * threadExShrPtr.cpp
 *
 *  Created on: 1 Mar 2017
 *      Author: alexgray
 */

#include "threadExShrPtr.h"

namespace uniqueExPtr {
	// a function consuming a unique_ptr can take it by value or by rvalue reference
	std::unique_ptr<D> pass_through(std::unique_ptr<D> p)
	{
		p->bar();
		return p;
	}

	void useUniquePtr()
	{
	  std::cout << "unique ownership semantics demo\n";
	  {
		  auto p = make_unique<D>(); // p is a unique_ptr that owns a D
		  auto q = pass_through(std::move(p));
		  assert(!p); // now p owns nothing and holds a null pointer
		  q->bar();   // and q owns the D object
	  } // ~D called here

	  std::cout << "Runtime polymorphism demo\n";
	  {
		std::unique_ptr<B> p = make_unique<D>(); // p is a unique_ptr that owns a D
													  // as a pointer to base
		p->bar(); // virtual dispatch

		std::vector<std::unique_ptr<B>> v;  // unique_ptr can be stored in a container
		v.push_back(make_unique<D>());
		v.push_back(std::move(p));
		v.emplace_back(new D);
		for(auto& p: v) p->bar(); // virtual dispatch
	  } // ~D called 3 times

	  std::cout << "Custom deleter demo\n";
	  std::ofstream("demo.txt") << 'x'; // prepare the file to read
	  {
		  std::unique_ptr<std::FILE, decltype(&std::fclose)> fp(std::fopen("demo.txt", "r"),
																&std::fclose);
		  if(fp) // fopen could have failed; in which case fp holds a null pointer
			std::cout << (char)std::fgetc(fp.get()) << '\n';
	  } // fclose() called here, but only if FILE* is not a null pointer
		// (that is, if fopen succeeded)

	  std::cout << "Custom lambda-expression deleter demo\n";
	  {
		std::unique_ptr<D, std::function<void(D*)>> p(new D, [](D* ptr)
			{
				std::cout << "destroying from a custom deleter...\n";
				delete ptr;
			});  // p owns D
		p->bar();
	  } // the lambda above is called and D is destroyed

	  std::cout << "Array form of unique_ptr demo\n";
	  {
		  std::unique_ptr<D[]> p{new D[3]};
	  } // calls ~D 3 times

	  {
	      // Use the default constructor.
	      std::unique_ptr<Vec3> v1 = make_unique<Vec3>();
	      // Use the constructor that matches these arguments
	      std::unique_ptr<Vec3> v2 = make_unique<Vec3>(0, 1, 2);

	      std::cout << "make_unique<Vec3>():      " << *v1 << '\n'
	                << "make_unique<Vec3>(0,1,2): " << *v2 << '\n';
	  }
	}
}

namespace threadExShrPtr {

	void thr(std::shared_ptr<Base> p)
	{
		std::this_thread::sleep_for(std::chrono::seconds(1));
		std::shared_ptr<Base> lp = p; // thread-safe, even though the
									  // shared use_count is incremented
		{
			static std::mutex io_mutex;
			std::lock_guard<std::mutex> lk(io_mutex);
			std::cout << "local pointer in a thread:\n"
					  << "  lp.get() = " << lp.get()
					  << ", lp.use_count() = " << lp.use_count() << '\n';
		}
	}

	void threadShow()
	{
		std::shared_ptr<Base> p = std::make_shared<Derived>();

		std::cout << "Created a shared Derived (as a pointer to Base)\n"
				  << "  p.get() = " << p.get()
				  << ", p.use_count() = " << p.use_count() << '\n';
		std::thread t1(thr, p), t2(thr, p), t3(thr, p);
		p.reset(); // release ownership from main
		std::cout << "Shared ownership between 3 threads and released\n"
				  << "ownership from main:\n"
				  << "  p.get() = " << p.get()
				  << ", p.use_count() = " << p.use_count() << '\n';
		t1.join(); t2.join(); t3.join();
		std::cout << "All threads completed, the last one deleted Derived\n";
		return;
	}
}




