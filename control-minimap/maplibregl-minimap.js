//code from https://github.com/aesqe/mapboxgl-minimap adapted to maplibre. 
class minimapControl {
  _ticking = false;
  _lastMouseMoveEvent = null;
  _parentMap = null;
  _isDragging = false;
  _isCursorOverFeature = false;
  _previousPoint = [0, 0];
  _currentPoint = [0, 0];
  _trackingRectCoordinates = [[[], [], [], [], []]]


  defaultOptions = {
    id: "maplibregl-minimap",
    width: "320px",
    height: "180px",
    center: [0, 0],
    zoom: 0,
    
    // should be a function; will be bound to Minimap
    zoomAdjust: null,

    // if parent map zoom >= 18 and minimap zoom >= 14, set minimap zoom to 16
    zoomLevels: [
      [18, 14, 16],
      [16, 12, 14],
      [14, 10, 12],
      [12, 8, 10],
      [10, 6, 8],
      [8, 4, 6],
      [6, 2, 4],
      [4, 0, 2]
    ],

    lineColor: "#08F",
    lineWidth: 1,
    lineOpacity: 1,

    fillColor: "#F80",
    fillOpacity: 0.25,

    dragPan: false,
    scrollZoom: false,
    boxZoom: false,
    dragRotate: false,
    keyboard: false,
    doubleClickZoom: false,
    touchZoomRotate: false
  }

  constructor(options) {
    this._options = {...this.defaultOptions, ...options};
    this._container = document.createElement("div");
    this._container.id = this._options.id;
    this._container.classList.add("maplibregl-ctrl");
    this._container.classList.add("maplibregl-ctrl-minimap");
    this._container.setAttribute('style', `width: ${this._options.width}; height: ${this._options.height};`);
    this._container.addEventListener("contextmenu", this._preventDefault);
  }

  _preventDefault ( e ) {
    e.preventDefault();
  }

  getDefaultPosition() {
    return 'bottom-right';
  }

  onAdd(map) {
    this._parentMap = map;

    const miniMap = this._miniMap = new maplibregl.Map({
      attributionControl: false,
      container: this._container,
      style: this._options.style || this._parentMap.getStyle(),
      zoom: this._options.zoom || this._parentMap.getZoom(),
      center: this._options.center || this._parentMap.getCenter()
    });
    if (this._options.maxBounds) miniMap.setMaxBounds(this._options.maxBounds);
    miniMap.on("load", this._load.bind(this));
    return this._container;
  }

  _load() {
    const opts = this._options;
    const parentMap = this._parentMap;
    const miniMap = this._miniMap;
    const interactions = [
      "dragPan", "scrollZoom", "boxZoom", "dragRotate",
      "keyboard", "doubleClickZoom", "touchZoomRotate"
    ];
    interactions.forEach(function(i){
      if( opts[i] !== true ) {
        miniMap[i].disable();
      }
    });
    if( typeof opts.zoomAdjust === "function" ) {
      this._options.zoomAdjust = opts.zoomAdjust.bind(this);
    } else if( opts.zoomAdjust === null ) {
      this._options.zoomAdjust = this._zoomAdjust.bind(this);
    }
    const bounds = miniMap.getBounds();
    this._convertBoundsToPoints(bounds);

    miniMap.addSource("trackingRect", {
      "type": "geojson",
      "data": {
        "type": "Feature",
        "properties": {
          "name": "trackingRect"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": this._trackingRectCoordinates
        }
      }
    });

    miniMap.addLayer({
      "id": "trackingRectOutline",
      "type": "line",
      "source": "trackingRect",
      "layout": {},
      "paint": {
        "line-color": opts.lineColor,
        "line-width": opts.lineWidth,
        "line-opacity": opts.lineOpacity
      }
    });

    // needed for dragging
    miniMap.addLayer({
      "id": "trackingRectFill",
      "type": "fill",
      "source": "trackingRect",
      "layout": {},
      "paint": {
        "fill-color": opts.fillColor,
        "fill-opacity": opts.fillOpacity
      }
    });

    this._trackingRect = this._miniMap.getSource("trackingRect");

    this._update();
    miniMap.resize();

    parentMap.on("move", this._update.bind(this));

    miniMap.on("mousemove", this._mouseMove.bind(this));
    miniMap.on("mousedown", this._mouseDown.bind(this));
    miniMap.on("mouseup", this._mouseUp.bind(this));

    miniMap.on("touchmove", this._mouseMove.bind(this));
    miniMap.on("touchstart", this._mouseDown.bind(this));
    miniMap.on("touchend", this._mouseUp.bind(this));

    this._miniMapCanvas = miniMap.getCanvasContainer();
    this._miniMapCanvas.addEventListener("wheel", this._preventDefault);
    this._miniMapCanvas.addEventListener("mousewheel", this._preventDefault);

  }

  _mouseDown(e)	{
    if( this._isCursorOverFeature )
    {
      this._isDragging = true;
      this._previousPoint = this._currentPoint;
      this._currentPoint = [e.lngLat.lng, e.lngLat.lat];
    }
  }

  _mouseUp() {
    this._isDragging = false;
    this._ticking = false;
  }
  
  _mouseMove(e){
    this._ticking = false;

    const miniMap = this._miniMap;
    const features = miniMap.queryRenderedFeatures(e.point, {
      layers: ["trackingRectFill"]
    });

    // don't update if we're still hovering the area
    if( ! (this._isCursorOverFeature && features.length > 0) )
    {
      this._isCursorOverFeature = features.length > 0;
      this._miniMapCanvas.style.cursor = this._isCursorOverFeature ? "move" : "";
    }

    if( this._isDragging )
    {
      this._previousPoint = this._currentPoint;
      this._currentPoint = [e.lngLat.lng, e.lngLat.lat];

      const offset = [
        this._previousPoint[0] - this._currentPoint[0],
        this._previousPoint[1] - this._currentPoint[1]
      ];

      const newBounds = this._moveTrackingRect(offset);

      this._parentMap.fitBounds(newBounds, {
        duration: 80,
        noMoveStart: true
      });
    }
  }

  _moveTrackingRect(offset){
    const source = this._trackingRect;
    const data = source._data;
    const bounds = data.properties.bounds;

    bounds._ne.lat -= offset[1];
    bounds._ne.lng -= offset[0];
    bounds._sw.lat -= offset[1];
    bounds._sw.lng -= offset[0];

    this._convertBoundsToPoints(bounds);
    source.setData(data);

    return bounds;
  }

  _setTrackingRectBounds(bounds){
    const source = this._trackingRect;
    const data = source._data;

    data.properties.bounds = bounds;
    this._convertBoundsToPoints(bounds);
    source.setData(data);
  }

  _convertBoundsToPoints(bounds){
    const ne = bounds._ne;
    const sw = bounds._sw;
    const trc = this._trackingRectCoordinates;

    trc[0][0][0] = ne.lng;
    trc[0][0][1] = ne.lat;
    trc[0][1][0] = sw.lng;
    trc[0][1][1] = ne.lat;
    trc[0][2][0] = sw.lng;
    trc[0][2][1] = sw.lat;
    trc[0][3][0] = ne.lng;
    trc[0][3][1] = sw.lat;
    trc[0][4][0] = ne.lng;
    trc[0][4][1] = ne.lat;
  }

  _update(e){
    if( this._isDragging  ) {
      return;
    }

    const parentBounds = this._parentMap.getBounds();

    this._setTrackingRectBounds(parentBounds);

    if( typeof this._options.zoomAdjust === "function" ) {
      this._options.zoomAdjust();
    }
  }

  _zoomAdjust(){
    const miniMap = this._miniMap;
    const parentMap = this._parentMap;
    const miniZoom = parseInt(miniMap.getZoom(), 10);
    const parentZoom = parseInt(parentMap.getZoom(), 10);
    const levels = this._options.zoomLevels;
    let found = false;

    levels.forEach(function(zoom){
      if( !found && parentZoom >= zoom[0] )
      {
        if( miniZoom >= zoom[1] ) {
          miniMap.setZoom(zoom[2]);
        }

        miniMap.setCenter(parentMap.getCenter());
        found = true;
      }
    });

    if( !found && miniZoom !== this._options.zoom )
    {
      if( typeof this._options.bounds === "object" ) {
        miniMap.fitBounds(this._options.bounds, {duration: 50});
      }

      miniMap.setZoom(this._options.zoom)
    }
  }

  onRemove(){
    this._container.parentNode?.removeChild(this._container);

    this._miniMap.off("mousemove", this._mouseMove.bind(this));
    this._miniMap.off("mousedown", this._mouseDown.bind(this));
    this._miniMap.off("mouseup", this._mouseUp.bind(this));

    this._miniMap.off("touchmove", this._mouseMove.bind(this));
    this._miniMap.off("touchstart", this._mouseDown.bind(this));
    this._miniMap.off("touchend", this._mouseUp.bind(this));
    this._miniMap.remove();
    this._parentMap.off("move", this._update.bind(this));
    delete this._parentMap;
  }
}
