#!/bin/bash

today=$(date +"%Y-%m")
last_month=$(date -d "$(date +%Y-%m-15) -1 month" +"%Y-%m")

url_today="https://download.db-ip.com/free/dbip-country-lite-$today.mmdb.gz"
url_last_month="https://download.db-ip.com/free/dbip-country-lite-$last_month.mmdb.gz"

output_file="dbip-country-lite.mmdb.gz"

echo "Trying to download today's DB-IP file..."
wget -q -O "$output_file" "$url_today"
if [ $? -eq 0 ]; then
    echo "Downloaded today's file successfully."
else
    echo "Today's file not available. Trying last month's file..."
    wget -q -O "$output_file" "$url_last_month"
    if [ $? -eq 0 ]; then
        echo "Downloaded last month's file successfully."
    else
        echo "Failed to download both today's and last month's files."
        exit 1
    fi
fi

echo "Unzipping the downloaded file..."
zcat "$output_file" > dbip.mmdb

if [ $? -eq 0 ]; then
    echo "Unzipped the file successfully."
else
    echo "Failed to unzip the file."
    exit 1
fi

echo "Cleaning up..."
rm "$output_file"
echo "Done."
