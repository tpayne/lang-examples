#!/bin/sh

mkdir /tmp/$$
cp -r ./src /tmp/$$/
cp -r ./resources /tmp/$$/src/
cp -r ./templates /tmp/$$/src/
cp package.json /tmp/$$/src/
cp package.json /tmp/$$/

cwd=$(pwd)
cd /tmp/$$/

echo "- Install packages..."
npm install --omit=dev
echo "- Build exe..."
pkg -t node18 ./src/ -o nodeexe --no-sign

if [ ! -d ${cwd}/bin ]; then
  mkdir ${cwd}/bin
fi
echo "- Copy exe to bin..."
cp nodeexe ${cwd}/bin

cd ${cwd}

rm -fr /tmp/$$/

