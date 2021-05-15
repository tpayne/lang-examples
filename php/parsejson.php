<?php

// Function to load JSON from a file (or URL)
function loadMetadata($url) {
    $content = file_get_contents("$url", true);
    $obj = json_decode($content,true);
    return $obj;
}

// Function to parse JSON and find value to match key
// Can match value or array 
function recurseFind($arr,$searchKey) {
    if ($arr != null) {
        foreach ($arr as $key => $val) {
            if ($key == $searchKey) {
                return $val;
            }
        }
        foreach ($arr as $key => $val) {
            if (is_array($val)) {
                $map = recurseFind($val,$searchKey);
                if ($map != null) {
                    return $map;
                }
            }
        }
    }
    return null;
}

$url = "";
$queryStr = "";

// Parse for args
for ($i=0; $i < $argc; $i++) {
    if ($argv[$i] == "--url") {
        $url = $argv[$i+1];
    } else if ($argv[$i] == "--query-key") {
        // Query matching will match full composite keys or single existing keys...
        $queryStr = $argv[$i+1];
    }
}

// Check args
if ($url == "" || $queryStr == "") {
    echo "Error: No arguments specified\n";
    exit(1);
}

echo "File = $url\n";
echo "queryStr = $queryStr\n";

// Load metadata
$obj =  loadMetadata($url);
$map = $obj;

// "network/interface/ipv4/ipAddress/privateIpAddress"
$key = $queryStr;

// Calculate last key
$array = preg_split("/\//", $key);
$lastKey = "";
foreach($array as $token) {
    $lastKey = $token;
}

// Get JSON key
$array = preg_split("/\//", $key);
foreach($array as $token) {
    $map = recurseFind($map,$token);
}

// Get value of last key
$map = recurseFind($map,$lastKey);

// Print value
$obj = $map;
if ($obj == null) {
    echo "No match found";
} else {
    if (is_array($obj)) {
        var_dump($obj);
    } else {
        print $obj;
    }
}

echo "\n";
exit(0);
?>
