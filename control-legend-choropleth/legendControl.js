class choroplethLegendControl {
  constructor(options) {
    this._options = {...options};
    this._container = document.createElement("div");
    this._container.classList.add("maplibregl-ctrl");
    this._container.classList.add("maplibregl-ctrl-choropleth");
    this.mousemove = this._mousemove.bind(this);
    this.mouseleave = this._mouseleave.bind(this);
  }
  onAdd(map) {
    this._map = map;
    const layer = this._map.getLayer(this._options.layerId);
    if (layer) {
      this._paint = this._map.getPaintProperty(this._options.layerId, 'fill-color');
      const labels = [];
      const colorScaleLength = this._options.colorScale.length;
      for (let i = 0; i < colorScaleLength; i++) {
        if (i < colorScaleLength - 1) {
          labels.push(`<li><span style="background-color: ${this._options.colorScale[i]}"></span><label>${this._options.limits[i].toLocaleString()} &mdash; ${this._options.limits[i+1].toLocaleString()}</label></li>`)
        } else {
          labels.push(`<li><span style="background-color: ${this._options.colorScale[i]}"></span><label>${this._options.limits[i].toLocaleString()} +</label></li>`)
        }
      }
      this._container.innerHTML = `<h3>Population<label></label></h3>
      <ul style="list-style-type:none;display:flex">${labels.join('')}</ul>
      `;
      const paintCategories = this._container.querySelectorAll('span');
      paintCategories.forEach((categorie, index) => {
        categorie.addEventListener('mouseover', this.filterByCategorie.bind(this));
        categorie.addEventListener('mouseleave', this.cleanFilterByCategorie.bind(this));
      });
      this._map.on('mousemove', this._options.layerId, this.mousemove);
      this._map.on('mouseleave', this._options.layerId, this.mouseleave);
    }
    return this._container;
  }
  _mousemove(e) {
    if (e.features[0]?.state?.population) {
      this.legendHighlight(e.features[0]);
    } else {
      this.clearLegendHighlight();
    }
  }
  _mouseleave() {
    this.clearLegendHighlight();
  }
  legendHighlight(feature) {
    if (this._selectedFeature !== feature.id) {
      this._map.getCanvas().style.cursor = 'pointer';
      const activeCategories = this._container.querySelector('li.active');
      this._container.querySelector('h3 > label').textContent = ` (${feature.properties.name})`;
      if (activeCategories) {
        activeCategories.classList.remove("active");
        activeCategories.querySelector('label').textContent = this._activeRange;
      }
      this._selectedFeature = feature.id;
      const population = feature.state.population;
      const limitIndex = this._options.limits.findIndex(l => l > population);
      const paintCategories = this._container.querySelectorAll('li');
      if (limitIndex > 0){
        const paintCategory = paintCategories[limitIndex-1];
        paintCategory.classList.add("active");
        this._activeRange = paintCategory.querySelector('label').textContent;
        paintCategory.querySelector('label').textContent = population.toLocaleString();
      } else {
        const paintCategory = paintCategories[paintCategories.length-1];
        paintCategory.classList.add("active");
        this._activeRange = paintCategory.querySelector('label').textContent;
        paintCategory.querySelector('label').textContent = population.toLocaleString();
      }
    }
  }
  clearLegendHighlight() {
    this._map.getCanvas().style.cursor = '';
    this._selectedFeature = null;
    const activeCategories = this._container.querySelector('li.active');
    this._container.querySelector('h3 > label').textContent = "";
    if (activeCategories) {
      activeCategories.classList.remove("active");
      activeCategories.querySelector('label').textContent = this._activeRange;
      this._activeRange = null;
    }
  }
  filterByCategorie(e){
    const index = [...e.target.parentNode.parentNode.children].indexOf(e.target.parentNode);
    const paint = [...this._paint];
    if(index < this._options.limits.length-1){
      paint[2] = ['case',
       ['all', ['>=', ['feature-state', 'population'], this._options.limits[index]], ['<', ['feature-state', 'population'], this._options.limits[index+1]]],
       this._options.colorScale[index],
       'rgba(0, 0, 0, 0)']
    }else{
      paint[2] = ['case',
       ['>=', ['feature-state', 'population'], this._options.limits[index]],
       this._options.colorScale[index],
       'rgba(0, 0, 0, 0)']
    }
    this._map.setPaintProperty(this._options.layerId, 'fill-color', paint);
  }
  cleanFilterByCategorie(e){
    this._map.setPaintProperty(this._options.layerId, 'fill-color', this._paint);
  }
  onRemove() {
    if (!this._map || !this._container) {
      return;
    }
    this._map.off('mousemove', this._options.layerId, this.mousemove);
    this._map.off('mouseleave', this._options.layerId, this.mouseleave);
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
    delete this._map;
  }
}