#!/bin/sh

echo "window._env_ = {" > /usr/share/nginx/html/env-config.js

env | grep "^VITE_" | while read -r line; do
  key=$(echo "$line" | cut -d '=' -f 1)
  value=$(echo "$line" | cut -d '=' -f 2-)
  echo "  $key: \"$value\"," >> /usr/share/nginx/html/env-config.js
done

echo "}" >> /usr/share/nginx/html/env-config.js