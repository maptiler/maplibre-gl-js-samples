class ElevationProvider {

  constructor(apiKey, globalMercator){
      this.apiKey = apiKey;
      this.gm = globalMercator;
      this.tiles = {}
  }

  async getElevation(lat, lon) {
      const tileIndex = this.getTileIndex(lat, lon, 12);
      const tileData = await this.getOrFetchTile(tileIndex);
      return this.decodeElevation(lat, lon, tileIndex, tileData);
  }

  async getOrFetchTile(tileIndex) {
      let tile;
      const key = this.createTileKey(tileIndex);
      if (key in this.tiles) {
          tile = this.tiles[key];
      } else {
          tile = await this.fetchTile(tileIndex);
          this.tiles[key] = tile;
      }
      return tile;
  }

  async fetchTile(tileIndex) {
      const url = `https://api.maptiler.com/tiles/terrain-rgb-v2/${tileIndex.zoom}/${tileIndex.x}/${tileIndex.y}.png?key=${this.apiKey}`
      const image = await this.loadImage(url);
      return this.getImageData(image);
  }

  loadImage(url) {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "Anonymous"
          img.addEventListener('load', () => resolve(img));
          img.addEventListener('error', reject);
          img.src = url;
      });
  }

  getImageData(image) {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height);
  }

  createTileKey(tileIndex) {
      return `${tileIndex.zoom}_${tileIndex.y}_${tileIndex.x}`;
  }

  getTileIndex(lat, lon, zoom) {
      const tms = this.gm.LatLonToTile(lat, lon, zoom);
      const google = this.gm.GoogleTile(tms.tx, tms.ty, zoom);
      return {
          x: google.tx,
          y: google.ty,
          zoom: zoom
      };
  }

  getTileExtentGeographic(x, y, zoom) {
      const tms = this.gm.TMSTile(x, y, zoom);
      const tileBounds = this.gm.TileBounds(tms.tx, tms.ty, zoom);
      return {
          lowerLeft: this.gm.MetersToLatLon(tileBounds.minx, tileBounds.miny),
          upperRight: this.gm.MetersToLatLon(tileBounds.maxx, tileBounds.maxy)
      }
  }

  getTileExtentPixels(x, y, zoom) {
      const tms = this.gm.TMSTile(x, y, zoom);
      const tileBounds = this.gm.TileBounds(tms.tx, tms.ty, zoom);
      return {
          lowerLeft: this.gm.MetersToPixels(tileBounds.minx, tileBounds.miny, zoom),
          upperRight: this.gm.MetersToPixels(tileBounds.maxx, tileBounds.maxy, zoom)
      }
  }

  decodeElevation(lat, lon, tileIndex, tileData) {
      const meters = this.gm.LatLonToMeters(lat, lon);
      const pixels = this.gm.MetersToPixels(meters.mx, meters.my, tileIndex.zoom);
      const tilePixelExtent = this.getTileExtentPixels(tileIndex.x, tileIndex.y, tileIndex.zoom);

      let xOffset = Math.floor(pixels.px - tilePixelExtent.lowerLeft.px);
      xOffset = Math.max(0, Math.min(tileData.width- 1, xOffset));
      let yOffset = tileData.height - Math.floor(pixels.py - tilePixelExtent.lowerLeft.py);
      yOffset = Math.max(0, Math.min(tileData.height - 1, yOffset));

      const imageDataIndex = yOffset * (tileData.width * 4) + xOffset * 4;
      const red = tileData.data[imageDataIndex];
      const green = tileData.data[imageDataIndex + 1];
      const blue = tileData.data[imageDataIndex + 2];

      return -10000 + ((red * 256 * 256 + green * 256 + blue) * 0.1);
  }
}