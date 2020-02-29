/* Live Bus Stop Info */

/* Magic Mirror
 * Module: FÖLI
 * Based on UK Live Bus Stop Info (https://github.com/nwootton/MMM-UKLiveBusStopInfo)
 *
 * Lähde: Turun seudun joukkoliikenteen liikennöinti- ja aikatauludata.
 * Aineiston ylläpitäjä on Turun kaupungin joukkoliikennetoimisto.
 * Aineisto on ladattu palvelusta http://data.foli.fi/ lisenssillä Creative Commons Nimeä 4.0 Kansainvälinen (CC BY 4.0).
 */

Module.register("MMM-FOLI", {

    // Define module defaults
    defaults: {
        updateInterval: 1 * 60 * 1000, // Update every x minute(s).
        animationSpeed: 2000,
        fade: true,
        fadePoint: 0.25, // Start on 1/4th of the list.
        initialLoadDelay: 0, // start delay seconds.

        apiBase: 'http://data.foli.fi/siri/sm/',

        stopid: '', // STOP ID for bus stop
        stopName: '', // Name of the stop

        limit: '', //Maximum number of results to display

        showRealTime: false, //expanded info when used with NextBuses
        showDelay: false, //expanded info when used with NextBuses
        showBearing: false, //show compass direction bearing on stop name
        maxDelay: -60, //if a bus is delayed more than 60 minutes exclude it
        debug: true
    },

    // Define required scripts.
    getStyles: function() {
        return ["bus.css", "font-awesome.css"];
    },

    // Define required scripts.
    getScripts: function() {
        return ["moment.js"];
    },

    //Define header for module.
    getHeader: function() {
        return this.config.header;
    },

    // Define start sequence.
    start: function() {
        Log.info("Starting module: " + this.name);

        // Set locale.
        moment.locale(config.language);

        this.buses = {};
        this.loaded = false;
        this.scheduleUpdate(this.config.initialLoadDelay);

        this.updateTimer = null;

        this.url = encodeURI(this.config.apiBase + this.config.stopid + '/pretty');

        this.updateBusInfo(this);
    },

    // updateBusInfo
    updateBusInfo: function(self) {
      if (this.hidden != true) {
        self.sendSocketNotification('GET_BUSINFO', { 'url': self.url });
      }
    },

    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("div");

        if (this.config.stopid === "") {
            wrapper.innerHTML = "Please set the STOP ID: " + this.stopid + ".";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        if (!this.loaded) {
            wrapper.innerHTML = "Loading bus Info ...";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        if (this.buses.stopName !== null) {
            this.config.header = this.buses.stopName;
        }

        //Dump bus data
        if (this.config.debug) {
            Log.info(this.buses);
        }

        // *** Start Building Table
        var bustable = document.createElement("table");
        bustable.className = "small";

        var titles = document.createElement("tr");
        bustable.appendChild(titles);

        var lineCell = document.createElement("td");
        lineCell.className = "line";
        lineCell.innerHTML = "Line";
        titles.appendChild(lineCell);

        var destionationCell = document.createElement("td");
        destionationCell.className = "destination";
        destionationCell.innerHTML = "Destination";
        titles.appendChild(destionationCell);

        var arrivalCell = document.createElement("td");
        arrivalCell.className = "arrival";
        arrivalCell.innerHTML = "Arrival";
        titles.appendChild(arrivalCell);

        var dueCell = document.createElement("td");
        dueCell.className = "due";
        dueCell.innerHTML = "Due";
        titles.appendChild(dueCell);

        //If we have departure info
        if (this.buses.data.length > 0) {
            for (var t in this.buses.data) {
                var bus = this.buses.data[t];

                var row = document.createElement("tr");
                bustable.appendChild(row);

                //Route name/Number
                var routeCell = document.createElement("td");
                routeCell.className = "route";
                routeCell.innerHTML = " " + bus.routeName + " ";
                row.appendChild(routeCell);

                //Direction Info
                var directionCell = document.createElement("td");
                directionCell.className = "dest";
                directionCell.innerHTML = bus.direction;
                row.appendChild(directionCell);

                //Time Tabled Departure
                var timeTabledCell = document.createElement("td");
                timeTabledCell.innerHTML = bus.timetableDeparture;
                timeTabledCell.className = "timeTabled";
                row.appendChild(timeTabledCell);

                if (this.config.showRealTime) {
                    //Real Time Feedback for Departure
                    var realTimeCell = document.createElement("td");
                    realTimeCell.innerHTML = "(" + bus.expectedDeparture + ")";
                    realTimeCell.className = "expTime";
                    row.appendChild(realTimeCell);
                }

                if (this.config.showDelay) {
                    //Delay Departure
                    var delayCell = document.createElement("td");

                    if (bus.delay > 1 || bus.delay < -1) {
                        label = " mins ";
                    } else {
                        label = " min ";
                    }

                    if (bus.delay < 0) {
                        delayCell.innerHTML = Math.abs(bus.delay) + label + "late";
                        delayCell.className = "late";
                    } else if (bus.delay > 0) {
                        delayCell.innerHTML = Math.abs(bus.delay) + label + "early";
                        delayCell.className = "early";
                    } else {
                        delayCell.innerHTML = " On Time ";
                        delayCell.className = "nonews";
                    }

                    row.appendChild(delayCell);
                }

                if (this.config.fade && this.config.fadePoint < 1) {
                    if (this.config.fadePoint < 0) {
                        this.config.fadePoint = 0;
                    }
                    var startingPoint = this.buses.length * this.config.fadePoint;
                    var steps = this.buses.length - startingPoint;
                    if (t >= startingPoint) {
                        var currentStep = t - startingPoint;
                        row.style.opacity = 1 - (1 / steps * currentStep);
                    }
                }
            }
        } else {
            var row1 = document.createElement("tr");
            bustable.appendChild(row1);

            var messageCell = document.createElement("td");
            messageCell.innerHTML = " " + this.buses.message + " ";
            messageCell.className = "bright";
            row1.appendChild(messageCell);

            var row2 = document.createElement("tr");
            bustable.appendChild(row2);

            var timeCell = document.createElement("td");
            timeCell.innerHTML = " " + this.buses.timestamp + " ";
            timeCell.className = "bright";
            row2.appendChild(timeCell);
        }

        wrapper.appendChild(bustable);
        return wrapper;

    },

    /* processBuses(data)
     * Uses the received data to set the various values into a new array.
     */
    processBuses: function(data) {
        //Define object to hold bus data
        this.buses = {};
        //Define array of departure info
        this.buses.data = [];
        this.buses.timestamp = new Date();
        this.buses.message = null;

        //Check we have data back from API
        if (typeof data !== 'undefined' && data !== null) {

            var stopName = "";

            //Try to get the stop name from config, could be pulled from API aswell
            if(this.config.stopName != null)
                stopName = this.config.stopName;

            this.buses.stopName = stopName;

            //Check we have route info
            if (typeof data.result !== 'undefined' && data.result !== null) {

              if (data.result.length > 0) {
                //Figure out how long the results are
                var counter = data.result.length;

                //See if there are more results than requested and limit if necessary
                if (counter > this.config.limit) {
                    counter = this.config.limit;
                }

                //Loop over the results up to the max - either counter of returned
                for (var i = 0; i < counter; i++) {

                    var bus = data.result[i];
                    var delay = null;
                    var thisTimetableTime;
                    var thisLiveTime;

                    var aimedDeparturetimeToDate = new Date(bus.aimeddeparturetime * 1000);
                    var expectedDeparturetimeToDate = new Date(bus.expecteddeparturetime * 1000);

                    var aimedDeparturetimeHours = aimedDeparturetimeToDate.getHours();
                    var aimedDeparturetimeMinutes = "0" + aimedDeparturetimeToDate.getMinutes();

                    var expectedDeparturetimeHours = expectedDeparturetimeToDate.getHours();
                    var expectedDeparturetimeMinutes = "0" + expectedDeparturetimeToDate.getMinutes();

                    var aimedFormattedTime = aimedDeparturetimeHours + ':' + aimedDeparturetimeMinutes.substr(-2);
                    var expectedFormattedTime = expectedDeparturetimeHours + ':' + expectedDeparturetimeMinutes.substr(-2);

                    thisTimetableTime = aimedFormattedTime;
                    thisLiveTime = expectedFormattedTime;

                    if (this.config.debug) {
                        Log.warn('===================================');
                        Log.warn(this.config.showDelay);
                        Log.warn(bus);
                        Log.warn(thisTimetableTime);
                        Log.warn(thisLiveTime);
                        Log.warn('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
                    }

                    //Only do these calc if showDelay is set in the config
                    if (this.config.showDelay) {
                        delay = aimedDeparturetimeMinutes - expectedDeparturetimeMinutes;
                    }

                    //Only push the info if the delay isn't excessive
                    if (delay > this.config.maxDelay) {
                        this.buses.data.push({
                          routeName: bus.lineref,
                          direction: bus.destinationdisplay,
                          timetableDeparture: thisTimetableTime,
                          expectedDeparture: thisLiveTime,
                          delay: delay
                        });
                    }
                    this.scheduleUpdate(this.config.updateInterval);
                }
              } else {
                  //No departures structure - set error message
                  this.buses.message = "No departure info returned";
                  if (this.config.debug) {
                      console.error("=======LEVEL 3=========");
                      console.error(this.buses);
                      console.error("^^^^^^^^^^^^^^^^^^^^^^^");
                  }
                }
                this.scheduleUpdate(this.config.updateInterval);
            } else {
                //No info returned - set error message
                this.buses.message = "No info about the stop returned";
                if (this.config.debug) {
                    Log.error("=======LEVEL 2=========");
                    Log.error(this.buses);
                    Log.error("^^^^^^^^^^^^^^^^^^^^^^^");
                }
                this.scheduleUpdate(this.config.updateInterval);
            }
        } else {
            //No data returned - set error message
            this.buses.message = "No data returned";
            if (this.config.debug) {
                Log.error("=======LEVEL 1=========");
                Log.error(this.buses);
                Log.error("^^^^^^^^^^^^^^^^^^^^^^^");
            }
            this.scheduleUpdate(this.config.updateInterval);
        }

        this.loaded = true;

        this.updateDom(this.config.animationSpeed);
    },

    /* scheduleUpdate()
     * Schedule next update.
     * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
     */
    scheduleUpdate: function(delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }

        var self = this;
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(function() {
            self.updateBusInfo(self);
        }, nextLoad);
    },


    // Process data returned
    socketNotificationReceived: function(notification, payload) {

        if (notification === 'BUS_DATA' && payload.url === this.url) {
            this.processBuses(payload.data);
            this.scheduleUpdate(this.config.updateInterval);
        }
    }

});
