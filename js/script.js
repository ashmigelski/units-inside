/// global storage
var storage = null;

/// helper function
function disableUI (disable, message, logout) {
	if (message) {
		alert(message);
	}
	if (logout) {
		wialon.core.Session.getInstance().logout(disableUI);
	} else {
		$("#login").prop("disabled", disable ? true : false);
	}
}

/// Callback after getting units
function getUnitsCallback (code, data) {
	if (code) {
		disableUI(false, "Error while getting units: " + code, 1);
	} else {
		if ("items" in data) {
			storage.units = data.items;
		}
	}
}

/// Get units
function getUnits () {
	var flags = wialon.item.Item.dataFlag.base | // 0x1 - base information about item
		wialon.item.Unit.dataFlag.lastMessage; // 0x400 - last message information
	var spec = { // search items specification. Think about it as written:
		"itemsType": "avl_unit", // Give me please all UNITS...
		"propName": "sys_name", // with NAME like...
		"propValueMask": "*", // any symbol...
		"sortType": "sys_name", // and sort result by NAME. Thanks!
	};
	wialon.core.Session.getInstance().searchItems(spec, 1, flags, 0, 0, getUnitsCallback);
}

/// Callback after getting resources
function getResourcesCallback (code, data) {
	if (code) {
		disableUI(false, "Error while getting resources: " + code, 1);
	} else {
		if ("items" in data) {
			storage.resources = data.items;
			// construct geofences table for all resources
			var html = "";
			// resources loop;
			for (var i = 0; i < data.items.length; i++) {
				var res = data.items[i];
				var zones = res.getZones();
				// zones loop
				for (j in zones) {
					html +=
						"<div class='row' id='zone_" + res.getId() + "_" + zones[j].id + "'>" +
							"<div class='name'>" +zones[j].n + "</div>" +
							"<div class='units'></div>" +
						"</div>";
				}
			}
			$("#result").html(html);
		}
	}
}

/// Get resources with geofences
function getResources () {
	var flags = wialon.item.Item.dataFlag.base | // 0x1 - base information about item
		wialon.item.Resource.dataFlag.zones; // 0x1000 - information about geofences
	var spec = { // search items specification. Think about it as written:
		"itemsType": "avl_resource", // Give me please all RESOURCES...
		"propName": "sys_name", // with NAME like...
		"propValueMask": "*", // any symbol...
		"sortType": "sys_name", // and sort result by NAME. Thanks!
	};
	wialon.core.Session.getInstance().searchItems(spec, 1, flags, 0, 0, getResourcesCallback);
}

/// Login callback
function loginCallback (code) {
	if (code) {
		disableUI(false, "Login error: " + code);
	} else {
		continueProcess();
	}
}

/// Continue process - get units and resources with geofences
function continueProcess() {
	wialon.core.Remote.getInstance().startBatch("getUnitsResources");
	getResources();
	getUnits();
	wialon.core.Remote.getInstance().finishBatch(finishProcess, "getUnitsResources");
}

/// Finish Process - get data about units inside geofences
function finishProcess () {
	if (storage.resources.length && storage.units.length) {
		var zoneId = {};
		for (var i = 0; i < storage.resources.length; i++) {
			zoneId[storage.resources[i].getId()] = [];
		}

		var result = {};
		wialon.core.Remote.getInstance().startBatch("getUnitsResources");
		for (var i = 0; i < storage.units.length; i++) {
			var pos = storage.units[i].getPosition();
			// if unit has position - try to detect geofences for it
			if (pos && pos.x && pos.y) {
				wialon.util.Helper.getZonesInPoint({
					zoneId: zoneId,
					lat: pos.y,
					lon: pos.x
				}, qx.lang.Function.bind(function (unit, code, data) {
					if (!code) {
						// show unit name in geofences rows on page
						for (var id in data) {
							for (var j = 0; j < data[id].length; j++) {
								var zone_tag = $("#zone_" + id + "_" + data[id][j] + " .units");
								zone_tag.html(zone_tag.html() + unit.getName() + " ");
							}
						}
					} else {
						console.log("Error getting point in zones: ", code);
					}
				}, this, storage.units[i]));
			}
		}
		wialon.core.Remote.getInstance().finishBatch(function () {
			disableUI(false, "", 1);
		}, "getUnitsResources");
	} else {
		disableUI(false, "Units or resources not found", 1);
	}
}

/// Start process - login
function startProcess() {
	// Wialon SDK JS url
	var url = "https://hst-api.wialon.com";
	wialon.core.Session.getInstance().initSession(url);
	wialon.core.Session.getInstance().loadLibrary("resourceZones");

	var token = $("#token").val(); // get token value from input
	if(!token){ // if token is empty
		disableUI(false, "Enter token");
	} else {
		storage = {
			units: [],
			resources: []
		};
		$("#result").empty();
		wialon.core.Session.getInstance().loginToken(token, "", loginCallback);
	}
}

/// When DOM ready
$(document).ready(function () {
	$("#login").click(function (evt) {
		if ($(this).prop("disabled")) {
			evt.preventDefault();
		} else {
			disableUI(true);
			startProcess();
		}
	});
});
