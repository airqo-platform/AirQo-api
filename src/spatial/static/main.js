function initializeMap(pm25Data) {
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: getInitialCenter(pm25Data),
        zoom: 10
    });

    pm25Data.forEach(point => {
        const popupContent = `
            <div>
                <strong>Location:</strong> ${point.name}<br>
                <strong>PM2.5:</strong> ${parseFloat(point.pm25).toFixed(2)} µg/m³
            </div>
        `;

        new mapboxgl.Marker({
            color: getColorForAqi(point.pm25)
        })
        .setLngLat([point.lon, point.lat])
        .setPopup(new mapboxgl.Popup().setHTML(popupContent))
        .addTo(map);
    });

    // Add navigation controls (zoom in/out)
    map.addControl(new mapboxgl.NavigationControl());
}

function getInitialCenter(data) {
    if (data.length > 0) {
        const firstPoint = data[0];
        return [firstPoint.lon, firstPoint.lat];
    }
    return [32.58, 0.32];  // Default to Kampala if no data
}

function getColorForAqi(aqi) {
    if (aqi <= 9) return 'green';
    if (aqi <= 35.4) return 'yellow';
    if (aqi <= 55.4) return 'orange';
    if (aqi <= 125.4) return 'red';
    if (aqi <= 225.4) return 'purple';
    return 'maroon';
}
