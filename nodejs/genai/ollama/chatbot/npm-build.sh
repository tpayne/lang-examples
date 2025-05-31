#!/bin/sh

# Create temporary directory
mkdir /tmp/$$

# Copy source directories and package.json
cp -r ./src /tmp/$$/
cp -r ./resources /tmp/$$/src/
cp -r ./templates /tmp/$$/src/
cp -r ./public /tmp/$$/src/

cp package.json /tmp/$$/src/
cp package.json /tmp/$$/

# Get the current working directory
cwd=$(pwd)
# Change to the temporary directory
cd /tmp/$$/

# --- Start: Add steps to handle certificates ---
# Create the certs directory within the temporary source structure
mkdir -p ./src/certs

# Conditionally copy certificates from original location (${cwd}/certs/)
# to the temporary source location (/tmp/$$/src/certs/)
# These commands use shell checks ([ -f file ]) and won't fail if the source files do not exist.
echo "Checking for SSL certificates in ${cwd}/certs/..."
if [ -f "${cwd}/certs/server.key" ]; then
  cp "${cwd}/certs/server.key" ./src/certs/
  echo "server.key found and copied."
else
  echo "server.key not found."
fi

if [ -f "${cwd}/certs/server.crt" ]; then
  cp "${cwd}/certs/server.crt" ./src/certs/
  echo "server.crt found and copied."
else
  echo "server.crt not found."
fi

# If you have a CA certificate (e.g., ca.crt) and want to include it:
# if [ -f "${cwd}/certs/ca.crt" ]; then
#   cp "${cwd}/certs/ca.crt" ./src/certs/
#   echo "ca.crt found and copied."
# else
#   echo "ca.crt not found."
# fi
# --- End: Add steps to handle certificates ---


echo "- Install packages..."
npm install --omit=dev

echo "- Build exe..."
# Pkg will now look for certs/*.key and certs/*.crt within ./src/ as defined in package.json assets
pkg -t node18 ./src/ -o nodeexe --no-sign

# Return to the original working directory
cd "${cwd}"

# Create bin directory if it doesn't exist
if [ ! -d "${cwd}/bin" ]; then
  mkdir "${cwd}/bin"
fi

echo "- Copy exe to bin..."
cp /tmp/$$/nodeexe "${cwd}/bin" # Copy the built executable from the temporary directory

# Clean up temporary directory
rm -fr /tmp/$$/