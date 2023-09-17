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

L.control.zoom({ position: 'topright' }).addTo(map)

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

$('#bike-lane-show').change(function () { // if the bike-lane-show checkbox is checked (event change)
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
let initFrom = dateToTS(new Date(2015, 0, 1));
let initTo = dateToTS(new Date(2023, 7, 23));

// Parse CSV file
Papa.parse('./data/crashes.csv', {
    download: true,
    header: true,
    dynamicTyping: true,

    // Main function
    complete: function (result) {

        let data = result.data;

        let heat = L.heatLayer(
            [],
            {
                radius: 5,
                blur: 3,
                maxZoom: 17,
                gradient: {
                    0.4: 'blue', 0.6: 'lime',
                    0.7: 'yellow', 0.8: 'red', 1: 'black'
                }
            }
        ).addTo(map);

        let geojsonLayer

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

            const dateText = text = formattedFrom === formattedTo ? `On <span class="fw4 date">${formattedFrom}</span>` :
                `<span class="fw4 date">From ${formattedFrom}</span> to <span class="fw4 date">From ${formattedTo}</span>`


            //contains date, county (if selected), and number of crashes in a circle
            const column1 = `
            <div class="flex flex-column mr3 justify-between">
                <div class="tc mb2">${dateText} - <span class="town">${townName}</span></div> 
                <div class="flex flex-column items-center tc">
                    <span class="bg-green-circle">${crashesTotal}</span>
                    <p class="b" style="color: var(--green);">Dangerous motor vehicle collisions</p>
                </div>
            </div>
        `

            //breakdown of the crashes by type
            const column2 = `
            <div class="flex flex-column mr3 justify-between">
                <div class="flex flex-row b items-center"><span class="md-grey-circle mr1">${crashesPed.toLocaleString()}</span><span>involved a pedestrian</span></div>
                <div class="flex flex-row b items-center"><span class="md-grey-circle mr1">${crashesCyc.toLocaleString()}</span><span>involved a cyclist</span></div>
                <div class="flex flex-row b items-center"><span class="md-grey-circle mr1">${crashesHitAndRun.toLocaleString()}</span><span>hit-and-runs</span></div>
            </div>
        `

            //crashes were fatal
            const column3 = `
            <div class="flex flex-column items-center tc justify-center align-center mt3">
                <span class="bg-red-circle">${crashesFatal}</span>
                <p class="b" style="color: var(--red);">Fatal Crashes</p>
            </div>
        `

            // text = '<span class="i dark-green fw5' + (filtered ? '' : 'red') + '"><br><br>'
            //     + (filtered ? filtered.toLocaleString() : 'No ') + ' crash'
            //     + (filtered === 1 ? '' : 'es') + ' satisf' + (filtered === 1 ? 'ies' : 'y')
            //     + ' your filtering criteria.</span>'

            $('#statsText').html(`<div class="flex flex-row justify-content justify-between mh4">
                                    ${column1}${column2}${column3}
                                </div>`) 

        }

        // Given `from` and `to` timestamps, updates the heatmap layer.
        function updateHeatLayer(from, to, callback = (group) => { }) {

            from = dateToTS(new Date(from * 1).setHours(0, 0, 0, 0)) / tsCoef;
            to = dateToTS(new Date(to * 1).setHours(23, 59, 59, 0)) / tsCoef;

            // All crashes between set dates
            // Crashes variable assigned here from parse output of crashes.csv
            let crashes = data.filter(function (point) {
                return point.d >= from && point.d <= to;
            })

            // Filter crashes based on checkboxes
            function filterCrashes() {
                return crashes.filter(function (point) {
                    return (($('#local').prop('checked') ? point.r !== 1 : false)
                        || ($('#highways').prop('checked') ? point.r === 1 : false))

                        && (($('#vehiclesOnly').prop('checked') ? (point.c === 0 && point.p === 0) : false)
                            || ($('#cyclists').prop('checked') ? point.c === 1 : false)
                            || ($('#pedestrians').prop('checked') ? point.p === 1 : false))

                        && (($('#injury').prop('checked') ? point.s === 'A' : false)
                            || ($('#fatal').prop('checked') ? point.s === 'K' : true))

                        && (($('#bikelane').prop('checked') ? point.blp === 'True' : true)
                            || (!$('#bikelane').prop('checked') ? point.blp !== 'True' : false))

                        && (($('#crashesHitAndRun').prop('checked') ? point.hr === 'True' : true)
                            || (!$('#crashesHitAndRun').prop('checked') ? point.hr !== 'True' : false))

                        // filter point 'tn' for town name, or show all towns if empty string
                        && (($('#town-name').val() === "")
                            || ($('#town-name').val() === point.tn) ? true : false)
                });
            }

            let crashesFiltered = filterCrashes();

            const area = $('#town-name').val() === "" ? 'Northeastern CT' : $('#town-name').val();

            function filterByTown(crashes) {
                return crashes.filter(function (point) {
                    return ($('#town-name').val() === "" ? true : $('#town-name').val() === point.tn);
                });
            }

            updateStatsText(
                tsToDate(from * 100000),  // Date from
                tsToDate(to * 100000),  // Date to
                filterByTown(crashes).length, // Total crashes
                filterByTown(crashes).filter(function (p) { return p.p === 1 }).length,  // Ped crashes
                filterByTown(crashes).filter(function (p) { return p.c === 1 }).length,  // Cyc crashes
                filterByTown(crashes).filter(function (p) { return p.v === 'True' }).length, // Hit and run status
                filterByTown(crashes).filter(function (p) { return p.s === 'K' }).length, // Fatal crashes
                crashesFiltered.length,
                area
            )

            // Despite zoom, clear individual points
            if (geojsonLayer) geojsonLayer.clearLayers()

            // Update the heatlayer
            let intensity = 20;

            // Main heatmap

            // setLatLngs is a Leaflet function that accepts the filtered crashes and sets the heatmap layer to those crashes
            heat.setLatLngs(
                crashesFiltered.map(function (point) { // crashesFiltered is the array of crashes that satisfy the filter criteria
                    return [point.x, point.y, intensity]; // x and y are the lat and long of the crash, intensity is the intensity of the heatmap

                })
            )


            if (map.getZoom() >= 12) { //hide heatmap
                heat.redraw();
                let intensity = 1; // quickly adjusts intensity of heatmap

                // If zoomed in all the way, show points instead of a heatmap
                if (map.getZoom() >= 17) {
                    intensity = 1
                    heat.setOptions({
                        maxZoom: 17,
                    })
                }

                if (map.getZoom() >= 18) intensity = 0
                // Update the heatlayer
                heat.setLatLngs(crashesFiltered.map(function (point) {
                    return [point.x, point.y, intensity];
                }))
            }

            const features = crashesFiltered.map(crash => {
                const diagramUrl = 'https://www.ctcrash.uconn.edu/MMUCCDiagram?id=' + crash.id + '&asImage=true'
                const content = `
                    <span class="avenir fw5">
                        <p>Crash ID: <b>${crash.id}</b></p>
                        <p>${tsToDate(crash.d * tsCoef)} at ${crash.t}</p>
                        <p>Severity: ${(crash.s === 'K' ?
                        'Fatal crash' :
                        crash.s === 'A' ?
                            'Suspected Serious Injury' :
                            'Property damage only' + '<br><p>Trafficway Ownership: ' + crash.s === '' ? 'Public road' : 'Other')}</p>
                        <p>There was ${crash.f === 'True' ? 'a bike lane' : 'no bike lane'} present.</p>
                        <a href="${diagramUrl}" target="_blank"><img src="${diagramUrl}" style="display:none" alt="Crash diagram" />Show crash diagram.</a>
                    </span>
                    <br>
                `
                return {
                    "type": "Feature",
                    "properties": { ...crash, diagramUrl, content },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [crash.y, crash.x] // seems like x and y are flipped?
                    }
                };
            })

            // circle.on('popupopen', function (e) {
            //     filters.style.display = "none";
            //     //move the map to center the popup
            //     const { lat, lng } = e.sourceTarget._latlng
            //     map.panTo([lat, lng + 0.001]);
            // });


            geojsonLayer = L.geoJSON(features, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 5,
                        color: '#000000',
                        fillColor: '#FF0000',
                        fillOpacity: map.getZoom() >= 12 ? 0.3 : 0,  // only show circles at zoom level 12 or higher
                        opacity: map.getZoom() >= 12 ? 1 : 0, // only show circles at zoom level 12 or higher
                        weight: 1,
                    });
                }
            })

            geojsonLayer.on('click', function (event) {
                const { lat, lng } = event.latlng
                //check how many features are around the point clicked, threshold is based on zoom level
                const mapZoom = map.getZoom()
                let miles = 1
                if (mapZoom >= 8 && mapZoom < 10) {
                    miles = 0.75
                } else if (mapZoom >= 12 && mapZoom < 14) {
                    miles = 0.05
                } else if (mapZoom >= 14) {
                    miles = 0.01
                }

                const buffer = turf.buffer(turf.point([lng, lat]), miles, { units: 'miles' });
                const selectedFeatures = features.filter(feature => turf.booleanIntersects(buffer, feature))

                if (selectedFeatures) {
                    //center on point
                    //map.flyTo([lat, lng], 15)
                    map.panTo([lat, lng])
                    let content = `<div>
                                        <p>There are ${selectedFeatures.length} crashes within this location</p>
                                        <hr style="margin: 1rem 0rem;"/>
                                    </div>`
                    if (selectedFeatures.length > 1) {
                        //if there is more than one feature, tell the user the amount of crashes at above levels 11

                        if (mapZoom >= 12) {
                            //merge info
                            content += selectedFeatures.map(feature => feature.properties.content).join('<hr style="margin: 1rem 0rem;"/>')
                        }
                    } else {
                        content = selectedFeatures[0].properties.content
                    }

                    const popup = L.popup({
                        closeOnClick: true,
                        autoClose: false
                    })
                        .setLatLng([lat, lng])
                        .setContent(content)
                        .openOn(map);
                }
            })

            geojsonLayer.addTo(map)
            callback(geojsonLayer)

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
            onChange: function (sliderData) {
                updateHeatLayer(sliderData.from, sliderData.to);
            }
        });

        // Re-draw heat layer when any filter (apart from street labels) is changed
        $('#filters .filter').not('#labels').change(function (e) {
            updateHeatLayer(
                slider[0].value.split(';')[0],
                slider[0].value.split(';')[1],
                (group) => {
                    // when filters are updated, zoom to new extent
                    map.fitBounds(group.getBounds());
                }
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
        updateHeatLayer(initFrom, initTo);
    }

}) // End of Papa parse

L.control.attribution().addTo(map) // Add attribution to map