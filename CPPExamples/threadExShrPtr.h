/*
 * threadExShrPtr.h
 *
 *  Created on: 1 Mar 2017
 *      Author: alexgray
 */

#ifndef THREADEXSHRPTR_H_
#define THREADEXSHRPTR_H_

#include <cassert>
#include <chrono>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

namespace uniqueExPtr {
struct Vec3 {
  int x, y, z;
  Vec3() : x(0), y(0), z(0) {}
  Vec3(int x, int y, int z) : x(x), y(y), z(z) {}
  friend std::ostream &operator<<(std::ostream &os, Vec3 &v) {
    return os << '{' << "x:" << v.x << " y:" << v.y << " z:" << v.z << '}';
  }
};

template <typename T, typename... Args>
std::unique_ptr<T> make_unique(Args &&...args) {
  return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

struct B {
  virtual void bar() { std::cout << "B::bar\n"; }
  virtual ~B() = default;
};

struct D : B {
  D() { std::cout << "D::D\n"; }
  ~D() { std::cout << "D::~D\n"; }
  void bar() override { std::cout << "D::bar\n"; }
};

extern void useUniquePtr();
} // namespace uniqueExPtr

namespace threadExShrPtr {
struct Base {
  Base() { std::cout << "  Base::Base()\n"; }
  ~Base() { std::cout << "  Base::~Base()\n"; }
};

struct Derived : public Base {
  Derived() { std::cout << "  Derived::Derived()\n"; }
  ~Derived() { std::cout << "  Derived::~Derived()\n"; }
};

extern void threadShow();
} // namespace threadExShrPtr

#endif /* THREADEXSHRPTR_H_ */
