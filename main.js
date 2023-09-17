// Initialize Leaflet map for Eastern CT
let map = L.map('map', {
    zoomControl: false,
    inertia: false,
    center: [41.8793, -72.1243],
    zoom: 10,
    minZoom: 8,
    maxZoom: 19,
    scrollWheelZoom: 'center',
    attributionControl: false,
    preferCanvas: true
    })


let stringobject = "string"

L.control.zoom({position: 'topright'}).addTo(map)

// Add base layer and attach it to map
let CartoDB_VoyagerLabelsUnder = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Add cycle route layer, leave unattached
let WaymarkedTrails_cycling = L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://waymarkedtrails.org">waymarkedtrails.org</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
})

$('#bike-lane-show').change(function() { // if the bike-lane-show checkbox is checked (event change)
    if ($(this).prop('checked')) {
        WaymarkedTrails_cycling.addTo(map);
    } else {
        WaymarkedTrails_cycling.remove();
    }
});

function dateToTS(date) {
    return date.valueOf();
}

function tsToDate(ts) {
    let d = new Date(ts);

    return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    });
}

// Set initial dates
let initFrom = dateToTS( new Date(2015, 0, 1) );
let initTo = dateToTS( new Date(2023, 7, 23) );

// Parse CSV file
Papa.parse('./data/crashes.csv', {
    download: true,
    header: true,
    dynamicTyping: true,

    // Main function
    complete: function(result) {

        let data = result.data;

        let heat = L.heatLayer(
            [],
            { radius: 5,
            blur: 3,
            maxZoom: 17,
            gradient: {0.4: 'blue', 0.6: 'lime',
            0.7: 'yellow', 0.8: 'red', 1: 'black'}
            }
        ).addTo(map);

        let individualPoints = L.layerGroup().addTo(map); // POIs are added here with the Leaflet layergroup function

        let tsCoef = 100000.0 // original timestamp needs to be multiplied by this to work in JS

        function updateStatsText(
          formattedFrom,
          formattedTo,
          crashesTotal,
          crashesPed,
          crashesCyc,
          crashesHitAndRun,
          crashesFatal,
          filtered,
          townName
        ) {

          let text = formattedFrom === formattedTo
              ? ('On '+ formattedFrom) : ('From <span class="fw4">'
              + formattedFrom + ' </span> to  <span class="fw4">'
              + formattedTo + "</span>")

          text += ', there ' + (crashesTotal === 1 ? 'was ' : 'were  <span class="orange fw5">') + (crashesTotal === 0 ? 'no' : crashesTotal.toLocaleString())
          text += ` dangerous motor vehicle crash${(crashesTotal === 1 ? '' : 'es')}</span> in <b> ${townName}</b>.`

          if (crashesTotal > 1) {
              text += ' Of those, <span class="dark-pink fw5">' + (crashesPed > 0 ? crashesPed.toLocaleString() : ' none');
              text += ' involved a pedestrian</span>, and <span class="dark-blue fw5">';
              text += (crashesCyc > 0 ? crashesCyc.toLocaleString() : ' none');
              text += ' involved a cyclist.</span>';
              text += ' <span class="fw4">' + crashesHitAndRun + ' crashes were hit and runs.</span>';
              text += ' <span class="dark-red fw6 bb"> ' + crashesFatal + ' crashes were fatal.</span>';
          }

          text += '<span class="i dark-green fw5' + (filtered ? '' : 'red') + '"><br><br>'
              + (filtered ? filtered.toLocaleString() : 'No ') + ' crash'
              + (filtered === 1 ? '' : 'es') + ' satisf' + (filtered === 1 ? 'ies' : 'y')
              + ' your filtering criteria.</span>'

          $('#statsText').html(text) // set the statsText div to the text variable

        }

        // Given `from` and `to` timestamps, updates the heatmap layer.
        function updateHeatLayer (from, to) {

          from = dateToTS(new Date(from * 1).setHours(0, 0, 0, 0)) / tsCoef;
          to = dateToTS(new Date(to * 1).setHours(23, 59, 59, 0)) / tsCoef;

          // All crashes between set dates
          // Crashes variable assigned here from parse output of crashes.csv
          let crashes = data.filter(function (point) {
              return point.d >= from && point.d <= to;
          })

          // Filter crashes based on checkboxes
          function filterCrashes() {
            return crashes.filter(function(point) {
              return (( $('#local').prop('checked') ? point.r !== 1 : false)
              || ( $('#highways').prop('checked') ? point.r === 1 : false))

              && (( $('#vehiclesOnly').prop('checked') ? (point.c === 0 && point.p === 0) : false)
              || ( $('#cyclists').prop('checked') ? point.c === 1 : false)
              || ( $('#pedestrians').prop('checked') ? point.p === 1 : false))

              && (( $('#injury').prop('checked') ? point.s === 'A' : false)
              || ( $('#fatal').prop('checked') ? point.s === 'K' : true))

              && (( $('#bikelane').prop('checked') ? point.blp === 'True' : true)
              || ( !$('#bikelane').prop('checked') ? point.blp !== 'True' : false))

              && (( $('#crashesHitAndRun').prop('checked') ? point.hr === 'True' : true)
              || ( !$('#crashesHitAndRun').prop('checked') ? point.hr !== 'True' : false))

              // filter point 'tn' for town name, or show all towns if empty string
              && (( $('#town-name').val() === "")
              || ( $('#town-name').val() === point.tn) ? true : false)
            });
          }

          let crashesFiltered = filterCrashes();

          const area = $('#town-name').val() === "" ? 'Northeastern CT' : $('#town-name').val();

          updateStatsText(
            tsToDate(from * 100000),  // Date from
            tsToDate(to * 100000),  // Date to
            crashes.length, // Total crashes
            crashes.filter(function(p) {return p.p === 1}).length,  // Ped crashes
            crashes.filter(function(p) {return p.c === 1}).length,  // Cyc crashes
            crashes.filter(function(p) {return p.v === 'True'}).length, // Hit and run status
            crashes.filter(function(p) {return p.s === 'K'}).length, // Fatal crashes
            crashesFiltered.length,
            area
          )

          // Despite zoom, clear individual points
          individualPoints.clearLayers();

          // Update the heatlayer
          let intensity = 20;

          // Main heatmap
          document.addEventListener('DOMContentLoaded', function() {
              // setLatLngs is a Leaflet function that accepts the filtered crashes and sets the heatmap layer to those crashes
              heat.setLatLngs(
                  crashesFiltered.map(function(point) { // crashesFiltered is the array of crashes that satisfy the filter criteria
                  return [point.x, point.y, intensity]; // x and y are the lat and long of the crash, intensity is the intensity of the heatmap

              })
          )
          });


          // If zoomed in all the way, show points instead of a heatmap
          if ( map.getZoom() >= 12 ) {

            heat.redraw();
            let intensity = 1; // quickly adjusts intensity of heatmap

            crashesFiltered.map(function(crash) { // crash function declared here

            let diagramUrl = 'https://www.ctcrash.uconn.edu/MMUCCDiagram?id=' + crash.id + '&asImage=true'

            // L.circleMarker is a Leaflet function that creates a circle marker at the lat and long of the crash
            let circle = L.circleMarker([crash.x, crash.y], {
                radius: 5,
                color: '#000000',
                fillColor: '#FFFFFF',
                fillOpacity: 1,
                opacity: 1,
                weight: 2,
                }).bindPopup(
                    '<span class="avenir fw5"><p>Crash ID: <b>' + crash.id + '</b></p><p>'
                    + tsToDate(crash.d * tsCoef) + ' at ' + crash.t + '</p>'
                    + '<p>Severity: ' + (crash.s === 'K' ? 'Fatal crash' : crash.s === 'A' ? 'Suspected Serious Injury' : 'Property damage only'
                    + '<br><p>Trafficway Ownership: ' + crash.s ==='' ? 'Public road' : 'Other')
                    + '<br><p>Motor vehicle was driving on: ' + crash.o + (crash.h === null ? '' : ' and the nearest cross-street is ' + crash.h + '</p>')
                    + '<p>There was ' + (crash.f === 'True' ? 'a bike lane ' : 'no bike lane ') + 'present.</p>'
                    + '<a href="' + diagramUrl + '" target="_blank"><img src="' + diagramUrl + '" style="display:none" alt="Crash diagram" />Show crash diagram.</a>'
                    + '</span><br>',
                    { minWidth: 200 }
                )

            // Unused function, but could be used to show crash diagram
            function showDiagram() {
                var diagramElement = document.getElementById("diagram");
                diagramElement.style.display = "block"
            }

            circle.on('popupopen', function () {
                filters.style.display = "none";
                map.setLatLng(map.getCenter() + [0, 0.0001]);
                console.log(map.getCenter())
            });

            circle.on('popupclose', function () {
                filters.style.display = "block";
            });

            individualPoints.addLayer(circle); // add the circle to the layergroup
            })

            // If zoomed in all the way, show points instead of a heatmap
            // Adjust heatmap as zoom changes
            if ( map.getZoom() >= 17 ) {
                intensity = 1;
                heat.setOptions({
                maxZoom: 17,
                })

                if ( map.getZoom() >= 18) {
                    intensity = 0;
                }
            } else {
                intensity = 4;
                heat.setOptions({maxZoom: 17,})
            }

          // Update the heatlayer
          heat.setLatLngs(crashesFiltered.map(function(point) {
                  return [point.x, point.y, intensity];}))
          } else {
              heat.setLatLngs(crashesFiltered.map(function(point) {
                      return [point.x, point.y, intensity];}))
          }

        } // End of updateHeatLayer function

        // Initialize Ion range slider
        let slider = $(".js-range-slider").ionRangeSlider({
            type: 'double',
            min: dateToTS(new Date(2015, 0)),
            max: dateToTS(new Date(2023, 6)),
            from: initFrom,
            to: initTo,
            prettify: tsToDate,
            skin: "big",
            onChange: function(sliderData) {
              updateHeatLayer(sliderData.from, sliderData.to);
            }
        });

        // Re-draw heat layer when any filter (apart from street labels) is changed
        $('#filters .filter').not('#labels').change(function (e) {
            updateHeatLayer(
                slider[0].value.split(';')[0],
                slider[0].value.split(';')[1]
            )
        })

        // Re-draw heat layer when zooming
        map.on('zoomend', function () {
            updateHeatLayer(
                slider[0].value.split(';')[0],
                slider[0].value.split(';')[1]
            )
        })

      // Set default properties
      $('#filters #pedestrians').prop('checked', 'checked');
      $('#filters #cyclists').prop('checked', 'checked');
      $('#filters #fatal').prop('unchecked', 'unchecked');
      $('#filters #local').prop('checked', 'checked');
      updateHeatLayer( initFrom, initTo );
    }

}) // End of Papa parse

L.control.attribution().addTo(map) // Add attribution to map