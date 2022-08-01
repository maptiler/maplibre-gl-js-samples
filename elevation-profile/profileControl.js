class ProfileControl {
  constructor(apiKey, elevationProvider) {
    this.apiKey = apiKey;
    this.chart = null;
    this.elevationProvider = elevationProvider;
    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        line_string: true,
        trash: true
      },
      defaultMode: 'draw_line_string'
    });
  }
  onCreateOrUpdate = async (e) => {
    const feature = e.features[0];
    await this.showChart(feature);
  }
  onDelete = () => {
    this.draw.deleteAll();
    this.clearChart();
  }
  showChart = async (feature) => {
    if (feature && feature.geometry) {
      const coordinates = feature.geometry.coordinates;
      if (coordinates) {
        await this.drawElevationProfile(coordinates);
        this._chartContainer.style.display = 'block';
      }
    }
  }
  clearChart(){
    this._chartContainer.style.display = 'none';
  }
  getZoomLevelResolution(latitude, zoom) {
    const metersPerPx = (Math.cos(latitude * Math.PI/180.0) * 2 * Math.PI * 6378137) / (512 * 2**zoom);
    return metersPerPx;
  }
  sampleProfileLine(coordinates) {
    const options = {units: 'meters'};
    const line = turf.lineString(coordinates);
    const lineLength = turf.length(line, options);
    let numSamples = 200;
    const metersPerPx = this.getZoomLevelResolution(coordinates[0][1], 12);
    const stepSize = Math.max(metersPerPx, lineLength / numSamples);
    numSamples = lineLength / stepSize;
    const samples = [];
    for (let i = 0; i <= numSamples; i++) {
      const along = turf.along(line, i * stepSize, options);
      const coords = along.geometry.coordinates;
      samples.push(coords);
    }
    return samples;
  }
  drawElevationProfile = async (coordinates) => {
    const samples = this.sampleProfileLine(coordinates);
    const elevationProfile = [];
    for (const c of samples) {
      const elevation = await this.elevationProvider.getElevation(c[1], c[0]);
      elevationProfile.push(elevation);
    }
    const minElevation = Math.min(...elevationProfile);
    this.chart = new Chartist.Line('.chartContainer', {
      series: [elevationProfile]
    }, {
      low: minElevation - 100,
      showArea: true,
      showPoint: false,
      fullWidth: true,
      lineSmooth: Chartist.Interpolation.cardinal({
        tension: 4,
        fillHoles: false
      })
    });
  }
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl';
    this._chartContainer = document.createElement('div');
    this._chartContainer.className = 'chartContainer';
    this._container.appendChild(this._chartContainer);
    this._map.addControl(this.draw);
    this._map.on('draw.create', this.onCreateOrUpdate);
    this._map.on('draw.delete', this.onDelete);
    this._map.on('draw.update', this.onCreateOrUpdate);
    return this._container;
  }
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map.off('draw.create', this.onCreateOrUpdate);
    this._map.off('draw.delete', this.onDelete);
    this._map.off('draw.update', this.onCreateOrUpdate);
    this._map.removeControl(this.draw);
    this._map = undefined;
  }
}