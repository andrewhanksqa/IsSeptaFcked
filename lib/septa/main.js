/**
* This module is used for interacting with SEPTA's API.
*
* @author Douglas Muth <http://www.dmuth.org/>
*/


//
// Our module that actually fetches and transforms the data from the API.
//
var api = require("./api.js");

var seq = require("seq");
var util = require("util");


//
// Our latest copy of the train statuses.
//
var _data = {};

//
// The raw data we get from SEPTA, mostly for debugging purposes.
//
var _raw_data = {};


/**
* This function is run at application boot time, and starts the 
* process of fetching data from SEPTA's API.
*/
exports.boot = function() {

	api_fetch_loop();

} // End of boot()


/**
* Return our data to an outside source.
*/
exports.getData = function(cb) {
	cb(null, _data);
}


/**
* Return our raw data. This will probably be used for debugging.
*/
exports.getRawData = function(cb) {
	cb(null, _raw_data);
}


/**
* This function fetches our data from SEPTA's API and then loops.
*/
function api_fetch_loop() {

	seq().seq(function() {
		api.go(this);

	}).seq(function(data) {

		//
		// If we have raw data, pull it out and store it in a separate variable.
		//
		if (data["raw_data"]) {
			_raw_data["trains"] = data["raw_data"];
			delete data["raw_data"];
		}

		//
		// Determine which trains are late past certain thresholds.
		//
		data["late"] = {};
		data["late"]["10"] = getLate(data["data"], 10, 29);
		data["late"]["30"] = getLate(data["data"], 30, 86400);

		//
		// Now create human-readable statuses
		//
		//data["num"] = 0; // Debugging
		data["status"] = {};
		if (data["num"] >= 1) {
			data["status"]["status"] = getIsFucked(data["late"]);
			data["status"]["late"] = [];

			var late = getTrainNames(data["late"]["10"]);
			for (var k in late) {
				var row = late[k];
				data["status"]["late"].push(row);
			}

			var late = getTrainNames(data["late"]["30"]);
			for (var k in late) {
				var row = late[k];
				data["status"]["late"].push(row);
			}

		} else {
			data["status"]["status"] = "(not sure)";
			data["status"]["message"] = 
				"Unable to retrieve train status in the last few minutes."
				;

		}
		
		//console.log(JSON.stringify(data["status"], null, 4));

		//
		// Store our main data in the "trains" index.
		// Yes, I may be doing stats on busses or light rail at some 
		// future point... :-)
		//
		_data["trains"] = data;

		schedule_api_fetch_loop();

	}).catch(function(error) {
		console.log("ERROR: " + error);
		schedule_api_fetch_loop();

	});

} // End of api.go()


/**
* Schedule the next call to api_fetch_loop().
*/
function schedule_api_fetch_loop() {

	var timeout_sec = 60 * 5;
	//var timeout_sec = 1; // Debugging
	var timeout = timeout_sec * 1000;

	var message = util.format("Will fetch data again in %d seconds.",
		timeout_sec);
	console.log("main.js: api_fetch_loop(): " + message);

	setTimeout(function() {
		api_fetch_loop();
		}, timeout);

} // End of schedule_api_fetch_loop()


/**
* This function returns trains which are late.
*
* @param array data Our list of trains to check
*
* @param integer min The minimum minutes a train must be late before we care
*
* @param integer max The maximum number of minutes a train must be late 
*	after which we DON'T care.  This is useful when checking to see if 
*	trains are only a few minutes late, for example.
*
* @return array An array of trains which are late.
*/
function getLate(data, min, max) {

	var retval = [];

	for (var k in data) {
		var row = data[k];
		var late = row["late"];

		if (late >= min && late <= max) {
			retval.push(row);
		}
	}

	return(retval);

} // End of getLate()


/**
* Logic to determine the over fuckedness of Regional Rail.
*
* @param array data Our associative array of late trains.
*
* @return string How fucked is Regional Rail?
*/
function getIsFucked(data) {

	var retval = "not fucked";

	if (data["10"].length >= 1) {
		retval = "a little fucked";
	} 

	if (data["30"].length >= 1) {
		retval = "fucked";
	}

	return(retval);

} // End of getIsFucked()


/**
* Convert an array of late trains into an array of human-readable statuses 
* that can be put on the website.
*
* @param array data Our array of late trains
*/
function getTrainNames(data) {

	var retval = [];

	for (var k in data) {
		var row = data[k];

		var str = util.format("Train #%s from %s to %s is %d minutes late",
			row["number"], row["from"], row["to"], row["late"]
			);
		retval.push(str);

	}

	return(retval);

} // End of getTrainNames()


/**
* Prime our data array.  This is done becuase normally during startup
* there is about a 300ms delay between when the webserver starts 
* listening and we fetch the data from SEPTA.
*
* Because of that, we want the website to display something sane during 
* that time, or else we have a race condition.  So this funciton, excuted 
* on the initial require() of this script, will pre-populate our data 
* array with something sensible.
*/
function prime() {

	var retval = {};
	retval["num"] = 0;
	retval["time"] = "never";
	retval["time_t"] = -1;
	retval["late"] = {};
	retval["status"] = {};
	retval["status"]["status"] = "(not sure)"
	retval["status"]["message"] =
		"Haven't yet retrieved train data from SEPTA!"
		;

	_data["trains"] = retval;

} // End of prime()

//
// Now call this directly. Because there are no callbacks in prime(), 
// this will fully execute before the require() on this module finishes.
//
prime();

